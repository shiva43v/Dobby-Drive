# DobbyDrive - Secure Nested Cloud Storage & MCP Server

DobbyDrive is a secure, Google Drive-inspired cloud storage web application. Users can sign up, log in, create nested folders to any depth, and upload images. The application recursively calculates and displays the total storage size of folders (including all nested subfolders and their images) in real-time.

Additionally, this project exposes its backend operations (creating folders, listing contents, and uploading files) as **MCP (Model Context Protocol) tools**, enabling AI assistants like Claude Desktop to interact with the drive through natural language.

---

## 🚀 Features

1. **Secure Authentication**: Traditional signup, login, and logout flow using JWT tokens stored securely. No third-party Auth providers (like Firebase) were used.
2. **Nested Folders**: Create nested folders to any depth.
3. **Recursive Folder Size**: Subfolders automatically display their aggregate size. The parent folders sum up the sizes of all images inside them and any descendant subfolders.
4. **Image Uploads**: Upload images with a custom display name and image file.
5. **Data Isolation**: Users have context isolation; they can only see folders and images they uploaded.
6. **MCP Server Integration (Bonus)**: Fully functional MCP stdio server with tools to list directory contents, create folders, and upload local files directly via chat prompts.
7. **Premium Responsive UI**: Elegant glassmorphic dark theme built using vanilla CSS with transitions, responsive grids, breadcrumb paths, visual storage meters, and image popups.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite, React Router DOM, Axios)
- **Backend**: Node.js, Express, Multer, JSON Web Tokens, Bcrypt
- **Database**: MongoDB (Mongoose ORM)
- **Protocol**: Model Context Protocol (MCP) SDK

---

## 🔑 Login Credentials

The project is pre-seeded with a default user for testing and MCP server usage:
- **Email**: `admin@dobbyads.com`
- **Password**: `password123`

You can also sign up with a new account via the frontend dashboard.

---

## 📦 Getting Started

### Prerequisites
- Node.js installed (v18+ recommended)
- MongoDB instance running locally (default: `mongodb://127.0.0.1:27017/dobbyads`) or a MongoDB Atlas connection string.

### Setup Instructions

1. **Clone/Download the repository** to your local machine.

2. **Set up the Backend**:
   ```bash
   cd backend
   npm install
   ```
   *Verify or update the configuration in `backend/.env`*:
   ```env
   PORT=5000
   MONGODB_URI=mongodb
   JWT_SECRET=super_secret_session_token_key_abc_123
   NODE_ENV=development
   MCP_USER_EMAIL=admin@dobbyads.com
   ```

3. **Set up the Frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

---

## 🏃 Running the Application

### 1. Run Backend Server
From the `backend` directory, run:
```bash
npm start
```
*The server will start on `http://localhost:5000`.*

### 2. Run Frontend Client
From the `frontend` directory, run:
```bash
npm run dev
```
*Vite will compile and open the web app on `http://localhost:5173/`.*

---

## 🔌 Connecting to Claude Desktop (MCP Server Setup)

To allow Claude Desktop (or any other MCP-compatible client) to interact with your drive:

1. Open your Claude Desktop configuration file.
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the `dobby-ads-drive` server definition. Replace the path in `args` with the absolute path to your `backend/mcp-server.js`:
   ```json
   {
     "mcpServers": {
       "dobby-ads-drive": {
         "command": "node",
         "args": [
           "C:/Users/shiva/Desktop/all/DobbyAds/backend/mcp-server.js"
         ],
         "env": {
           "MONGODB_URI": "mongodb://127.0.0.1:27017/dobbyads",
           "MCP_USER_EMAIL": "admin@dobbyads.com"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**.

4. You can now use natural language in Claude Desktop to manage folders and upload local files, for example:
   - *"List my drive items."*
   - *"Create a folder called 'Campaigns' in root."*
   - *"Upload the image at 'C:/Users/username/Pictures/banner.png' with the name 'Main Banner' inside the Campaigns folder."* (MCP will copy the file to the drive's local storage and index it in the MongoDB database!)

<img width="1918" height="765" alt="Screenshot 2026-05-30 183838" src="https://github.com/user-attachments/assets/3943e2ff-066f-4f41-8505-ddef3bc9047d" />
<img width="1899" height="835" alt="Screenshot 2026-05-30 183432" src="https://github.com/user-attachments/assets/d06f0fae-51ab-463e-8594-081b20771d1d" />

