# ChatFlow - No-Code Messenger Chatbot Platform

ChatFlow is a SaaS platform that allows businesses to create, manage, and automate Facebook Messenger chatbots using a visual flow builder. It features real-time Facebook integration, multi-tenant architecture, and a drag-and-drop interface.

## 🚀 Features

- **Visual Flow Builder**: Create conversation flows with drag-and-drop nodes (Trigger, Message, Condition).
- **Facebook Integration**: Seamless OAuth login and Page management via Meta Graph API.
- **Multi-Tenant**: Support for multiple users and multiple Facebook Pages per user.
- **Real-Time Webhooks**: Instant message processing and automated responses.
- **Secure**: Encrypted access tokens and secure webhook verification.
- **Analytics**: Track message counts and plan limits (Starter, Business, Pro).

## 🛠 Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React, Vite, Tailwind CSS, React Flow
- **Database**: SQLite (via `better-sqlite3`) - *Easily migratable to PostgreSQL*
- **Authentication**: Facebook OAuth 2.0
- **Deployment**: Ready for Render, Railway, or any Node.js host.

## 📋 Prerequisites

- Node.js 18+
- A Meta for Developers Account
- A Facebook App (Business Type)

## 🔧 Local Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/chatflow.git
    cd chatflow
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file based on `.env.example`:
    ```env
    META_CLIENT_ID=your_facebook_app_id
    META_CLIENT_SECRET=your_facebook_app_secret
    META_VERIFY_TOKEN=your_secure_random_token
    ENCRYPTION_KEY=32_character_random_string
    APP_URL=http://localhost:3000
    ```

4.  **Start the development server**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## ☁️ Deployment Guide (Render)

This application is configured for easy deployment on [Render](https://render.com).

### Step 1: Create a Web Service
1.  Log in to Render and click **New +** -> **Web Service**.
2.  Connect your GitHub repository.
3.  Give your service a name (e.g., `chatflow-app`).

### Step 2: Configure Build & Start Commands
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Step 3: Environment Variables
Add the following environment variables in the Render dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Optimizes for production |
| `META_CLIENT_ID` | `[Your App ID]` | From Meta App Dashboard |
| `META_CLIENT_SECRET` | `[Your App Secret]` | From Meta App Dashboard |
| `META_VERIFY_TOKEN` | `[Random String]` | Used to verify webhook |
| `ENCRYPTION_KEY` | `[32-char string]` | For encrypting tokens |
| `APP_URL` | `https://[your-app].onrender.com` | Your Render URL |

### Step 4: Persistence (Important)
Since this app uses SQLite, data is stored in a local file (`bot.db`). On Render's free tier, the filesystem is ephemeral (data is lost on restart).
- **For Production**: Add a **Disk** in Render settings and mount it to `/data`, then update the database path in `server.ts` to `/data/bot.db`.
- **Alternative**: Migrate to PostgreSQL (recommended for scaling).

## 📘 Meta (Facebook) App Configuration

To make the chatbot work, you must configure your Facebook App correctly.

### 1. Create App
1.  Go to [Meta for Developers](https://developers.facebook.com/).
2.  Create a new app -> Select **Business** type.

### 2. Add Products
1.  Add **Facebook Login for Business**.
2.  Add **Messenger**.

### 3. Configure Facebook Login
1.  Go to **Facebook Login** -> **Settings**.
2.  Add your **Valid OAuth Redirect URIs**:
    - `https://[your-app].onrender.com/api/auth/facebook/callback`
    - `http://localhost:3000/api/auth/facebook/callback` (for local dev)

### 4. Configure Messenger Webhook
1.  Go to **Messenger** -> **Settings**.
2.  Scroll to **Webhooks** -> **Setup Webhook**.
3.  **Callback URL**: `https://[your-app].onrender.com/webhook`
4.  **Verify Token**: The value you set for `META_VERIFY_TOKEN`.
5.  **Subscription Fields**: Select `messages` and `messaging_postbacks`.

### 5. Permissions
For the app to work fully, you need advanced access for:
- `pages_show_list`
- `pages_messaging`
- `pages_manage_metadata`

*Note: Until you complete Business Verification, the app will only work for users with a role (Admin/Developer) on the Facebook App.*

## 🛡 Security Notes

- **Token Encryption**: Access tokens are encrypted at rest using AES-256-CBC.
- **Webhook Verification**: All incoming webhooks are verified using `x-hub-signature-256`.
- **Isolation**: Multi-tenant architecture ensures users can only access their own pages and flows.

## 📄 License

MIT
