# AI-Powered Chatbot with File Integration

This is a modern, feature-rich chatbot application built with **Next.js** and powered by the **Google Gemini API**. It provides a seamless, real-time conversational experience with support for file uploads (images and PDFs), a dynamic and appealing user interface, and practical features like chat export.

---

## 🖼️ Images and 🔗 Link
<img width="1894" height="964" alt="image" src="https://github.com/user-attachments/assets/5c66278d-a4fa-4b43-85a0-9f62681b14b0" />
<img width="1890" height="967" alt="image" src="https://github.com/user-attachments/assets/1a148d28-167c-486c-99d6-0fdd51ad6509" />
- **Link**: https://ai-bot-xi-beige.vercel.app/

---

## 🚀 Features

- **Real-Time Streaming**: Get instant, real-time responses from the AI as they are being generated.
- **File Uploads**: Upload and ask questions about images and PDF documents.
- **Modern UI**: A sleek, responsive, and animated user interface built with Tailwind CSS.
- **Predefined Prompts**: Start conversations easily with a set of example prompts.
- **Code Highlighting**: Code snippets in the chat are automatically highlighted for readability.
- **Export Chat**: Download your entire conversation history as a `.txt` file.
- **Error Handling**: Gracefully handles API errors and provides clear feedback to the user.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **File Parsing**: [pdf-parse](https://www.npmjs.com/package/pdf-parse)

---

## ⚙️ Getting Started

Follow these steps to get the project up and running on your local machine.

### ✅ Prerequisites

- **Node.js** (v18 or later)
- **npm**, **yarn**, or **pnpm**

### 📥 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-chatbot.git
cd ai-chatbot
```

### 📦 2. Install Dependencies

```bash
npm install
```

### 🔐 3. Set Up Environment Variables

You’ll need a **Google Gemini API key** to run the application.

1. Create a file named `.env.local` in the root directory.
2. Add your API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 🧪 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

---

## 💬 Usage

- **Start a Conversation**: Click the "Asking" button on the landing page to open the chat window.
- **Send a Message**: Type your message in the input field and press Enter or click the send icon.
- **Upload a File**: Click the paperclip icon to upload an image or a PDF file.
- **Use Predefined Prompts**: Use the sample prompts to quickly get started when chat is empty.
- **Export Chat**: Click the download icon in the header to save your chat as a `.txt` file.

---

## 📁 Project Structure

```
/src
├── app
│   ├── api
│   │   └── chat
│   │       └── route.ts        # Backend API for handling chat logic
│   ├── globals.css             # Global styles and theme
│   ├── layout.tsx              # Main layout for the application
│   └── page.tsx                # The main chatbot UI and landing page
├── assets
│   └── images
│       └── my-logo.png         # Your logo file
├── components
│   ├── Header.tsx              # The main header for the chat window
│   └── ui                      # UI components from shadcn/ui
└── lib
    └── utils.ts                # Utility functions
```

---

## ☁️ Deployment

The easiest way to deploy this **Next.js** application is with **[Vercel](https://vercel.com/)**.

1. Push your code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), connect your GitHub account.
3. Import your repository and follow the setup steps.
4. Add your environment variable (`GEMINI_API_KEY`) in the Vercel dashboard.

---

## 👏 Acknowledgements

- [Google Gemini API](https://ai.google.dev/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ShadCN UI](https://ui.shadcn.com/)
