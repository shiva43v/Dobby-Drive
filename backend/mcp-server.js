import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { copyFile, stat } from 'fs/promises';
import dotenv from 'dotenv';

import User from './models/User.js';
import Folder from './models/Folder.js';
import Image from './models/Image.js';
import { calculateFolderSize } from './routes/folders.js';

dotenv.config();

// Connect to MongoDB
const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dobbyads';
await mongoose.connect(connStr);

// Create or find default MCP user context
const DEFAULT_EMAIL = process.env.MCP_USER_EMAIL || 'admin@dobbyads.com';
let mcpUser = await User.findOne({ email: DEFAULT_EMAIL });
if (!mcpUser) {
  mcpUser = await User.create({
    username: 'admin',
    email: DEFAULT_EMAIL,
    password: 'password123', // Will be hashed by User schema pre-save hook
  });
  console.error(`MCP Server: Created default user admin@dobbyads.com / password123`);
} else {
  console.error(`MCP Server: Using existing user context: ${DEFAULT_EMAIL}`);
}

const server = new Server(
  {
    name: "dobby-ads-drive",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_files_and_folders",
        description: "List all folders and images in a directory. By default, lists the root directory.",
        inputSchema: {
          type: "object",
          properties: {
            parentId: {
              type: "string",
              description: "Optional folder ID to explore. Omit or pass null to list the root directory."
            }
          }
        }
      },
      {
        name: "create_folder",
        description: "Create a new folder inside the drive.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the folder to create."
            },
            parentId: {
              type: "string",
              description: "Optional parent folder ID. Omit to create in the root directory."
            }
          },
          required: ["name"]
        }
      },
      {
        name: "upload_image",
        description: "Upload an image from a local path on the computer into the drive.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Custom name of the image in the drive."
            },
            filePath: {
              type: "string",
              description: "Absolute local path to the image on the computer (e.g. C:/Users/name/Pictures/pic.png)."
            },
            parentId: {
              type: "string",
              description: "Optional folder ID to upload this image into. Omit to upload to root."
            }
          },
          required: ["name", "filePath"]
        }
      }
    ]
  };
});

// Define tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_files_and_folders": {
        const parentId = args.parentId || null;

        const queryParent = parentId === 'null' || parentId === '' ? null : parentId;

        // Fetch folders
        const folders = await Folder.find({
          user: mcpUser._id,
          parent: queryParent,
        }).sort({ createdAt: -1 });

        // Populate sizes for folders
        const foldersWithSizes = await Promise.all(
          folders.map(async (f) => {
            const size = await calculateFolderSize(f._id, mcpUser._id);
            return {
              id: f._id.toString(),
              name: f.name,
              parent: f.parent ? f.parent.toString() : null,
              sizeBytes: size,
              sizeFormatted: `${(size / (1024 * 1024)).toFixed(2)} MB`,
              createdAt: f.createdAt,
            };
          })
        );

        // Fetch images
        const images = await Image.find({
          user: mcpUser._id,
          folder: queryParent,
        }).sort({ createdAt: -1 });

        const formattedImages = images.map((img) => ({
          id: img._id.toString(),
          name: img.name,
          filename: img.filename,
          sizeBytes: img.size,
          sizeFormatted: `${(img.size / (1024 * 1024)).toFixed(2)} MB`,
          url: img.url,
          createdAt: img.createdAt,
        }));

        // Fetch breadcrumbs
        let breadcrumbs = ["Root"];
        if (queryParent) {
          const currentFolder = await Folder.findOne({ _id: queryParent, user: mcpUser._id })
            .populate('ancestors', 'name');
          if (currentFolder) {
            breadcrumbs = [
              "Root",
              ...currentFolder.ancestors.map((a) => a.name),
              currentFolder.name,
            ];
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  currentDirectory: breadcrumbs.join(" > "),
                  folderId: queryParent,
                  subfolders: foldersWithSizes,
                  images: formattedImages,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_folder": {
        const folderName = args.name;
        const parentId = args.parentId || null;

        let ancestors = [];
        if (parentId) {
          const parentFolder = await Folder.findOne({ _id: parentId, user: mcpUser._id });
          if (!parentFolder) {
            return {
              isError: true,
              content: [{ type: "text", text: `Parent folder with ID ${parentId} not found.` }],
            };
          }
          ancestors = [...parentFolder.ancestors, parentFolder._id];
        }

        const newFolder = await Folder.create({
          name: folderName,
          parent: parentId || null,
          ancestors,
          user: mcpUser._id,
        });

        return {
          content: [
            {
              type: "text",
              text: `Folder created successfully!\n\nID: ${newFolder._id}\nName: ${newFolder.name}\nParent ID: ${newFolder.parent || "Root"}`,
            },
          ],
        };
      }

      case "upload_image": {
        const imageName = args.name;
        const localFilePath = args.filePath;
        const parentId = args.parentId || null;

        // Check if local file exists
        if (!fs.existsSync(localFilePath)) {
          return {
            isError: true,
            content: [{ type: "text", text: `Local file not found at path: ${localFilePath}` }],
          };
        }

        // Validate that it's an image
        const ext = path.extname(localFilePath).toLowerCase();
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        if (!allowedExtensions.includes(ext)) {
          return {
            isError: true,
            content: [{ type: "text", text: `Only image files are allowed. Got extension: ${ext}` }],
          };
        }

        // Get file stats (size)
        const fileStats = await stat(localFilePath);

        // Verify folder exists if specified
        let targetFolderId = null;
        if (parentId) {
          const existingFolder = await Folder.findOne({ _id: parentId, user: mcpUser._id });
          if (!existingFolder) {
            return {
              isError: true,
              content: [{ type: "text", text: `Destination folder with ID ${parentId} not found.` }],
            };
          }
          targetFolderId = existingFolder._id;
        }

        // Set destination filename in uploads/ folder
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const destFilename = `img-${uniqueSuffix}${ext}`;
        const __dirname = path.resolve();
        const destPath = path.join(__dirname, 'uploads', destFilename);

        // Ensure uploads directory exists
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Copy physical file
        await copyFile(localFilePath, destPath);

        // Store image in Database
        const PORT = process.env.PORT || 5000;
        const imageUrl = `http://localhost:${PORT}/uploads/${destFilename}`;

        const newImage = await Image.create({
          name: imageName,
          filename: destFilename,
          size: fileStats.size,
          mimetype: `image/${ext.substring(1)}`, // basic mime-type parsing
          folder: targetFolderId,
          user: mcpUser._id,
          url: imageUrl,
        });

        return {
          content: [
            {
              type: "text",
              text: `Image uploaded successfully!\n\nID: ${newImage._id}\nName: ${newImage.name}\nSize: ${(newImage.size / 1024).toFixed(2)} KB\nURL: ${newImage.url}`,
            },
          ],
        };
      }

      default:
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
    };
  }
});

// Run Stdio Transport Server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Server running on Stdio transport");
