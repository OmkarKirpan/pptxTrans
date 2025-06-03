# 🚀 PowerPoint Translator App 📝

Welcome to the **PowerPoint Translator App**! This project aims to provide a seamless and intuitive web application for translating PowerPoint (PPTX) presentations while preserving formatting and enabling collaboration.

## ✨ Overview

Translating PowerPoint presentations can be a tedious task, often leading to formatting issues and inefficient workflows. This application addresses these challenges by:

*   🖼️ **Preserving Visual Fidelity:** Converts slides to high-quality SVG images, ensuring that layouts, fonts, and visual elements are maintained. Text is overlaid for translation, minimizing disruption.
*   ⚙️ **Streamlining Translation:** Offers a centralized platform for managing translation projects from upload to a visual editor.
*   💬 **Facilitating Collaboration:** Allows users to comment directly on text elements within the slide context (future feature).
*   ⏱️ **Increasing Efficiency:** Reduces the manual effort involved in traditional translation methods.

## 🔑 Key Features

*   👤 **User Authentication:** Secure login and signup using Supabase Auth.
*   📊 **Dashboard:** Manage translation sessions, view progress, and initiate new translations.
*   📤 **PPTX Upload & Configuration:** A multi-step wizard to:
    *   Upload `.pptx` files.
    *   Name translation sessions.
    *   Select source and target languages.
*   ✍️ **Slide Editor:**
    *   High-fidelity visual representation of slides (server-side SVG conversion).
    *   Interactive text elements overlaid on slide images for easy translation.
    *   Slide navigator with thumbnails.
    *   Text editing interface (popup/inline) showing original and translated text.
*   🗣️ **Comments & Collaboration (Planned):** Attach comments to text elements, reply, and resolve.
*   💾 **Export (Planned):** Export the translated presentation, aiming to reconstruct a PPTX file with translated text.

## 🛠️ Technology Stack

### Frontend
*   **Framework:** [Next.js](https://nextjs.org/) 14 (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **UI Library:** [React](https://reactjs.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Components:** [shadcn/ui](https://ui.shadcn.com/) - Accessible and customizable UI components.

### Backend-as-a-Service (BaaS)
*   **Provider:** [Supabase](https://supabase.io/)
    *   **Authentication:** Supabase Auth
    *   **Database:** Supabase PostgreSQL
    *   **Storage:** Supabase Storage (for PPTX files, SVGs, etc.)

### PPTX Processing Service (Backend)
*   **Location:** `pptx-processor-service/` directory
*   **Framework:** [Python FastAPI](https://fastapi.tiangolo.com/)
*   **Core Task:** Converts PPTX slides to SVGs and extracts text elements with coordinates.
*   **Key Libraries:**
    *   `python-pptx`: For parsing PPTX files.
    *   `LibreOffice`: For high-quality PPTX to SVG conversion (run in headless mode).
    *   `asyncio`: For background task processing.
    *   Supabase Python SDK: For interacting with Supabase.

## 🏗️ Architecture

The application follows a microservice-inspired architecture:

1.  🌐 **Next.js Frontend:**
    *   Handles all user interface interactions, client-side logic, and authentication.
    *   Communicates with Supabase for data and auth.
    *   Sends PPTX files to the Processor Service for conversion.
2.  ⚙️ **Python FastAPI PPTX Processor Service:**
    *   A separate microservice dedicated to the computationally intensive task of processing PowerPoint files.
    *   Receives PPTX files from the frontend.
    *   Converts slides to SVG images.
    *   Extracts text content and positional data.
    *   Stores processed SVGs and data into Supabase (Storage and Database).
3.  ☁️ **Supabase:**
    *   Acts as the central BaaS provider.
    *   Manages user authentication.
    *   Stores all application data (user info, translation sessions, slide data, text elements, comments).
    *   Provides file storage for original PPTX files and generated SVG slide images.

This separation ensures that the resource-intensive PPTX processing (which requires tools like LibreOffice) does not overload the Next.js frontend or run into limitations of serverless environments.

```mermaid
graph TD
    User[👤 User] -- Interacts via Browser --> Frontend[🌐 Next.js Frontend]

    Frontend -- Auth/Data/Storage --> Supabase[☁️ Supabase BaaS]
    Frontend -- Uploads PPTX / Polls Status --> ProcessorService[⚙️ Python FastAPI PPTX Processor]

    ProcessorService -- Saves/Reads Files --> SupabaseStorage[Supabase Storage]
    ProcessorService -- Saves/Reads Metadata --> SupabaseDB[Supabase Database]
    ProcessorService -- Uses --> LibreOffice[LibreOffice (headless)]

    subgraph "Cloud Services"
        Supabase
        SupabaseStorage
        SupabaseDB
    end

    subgraph "Backend Services"
        ProcessorService
        LibreOffice
    end
```

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (version X.X.X or higher - *Specify version*)
*   [npm](https://www.npmjs.com/)/[yarn](https://yarnpkg.com/)/[pnpm](https://pnpm.io/)/[bun](https://bun.sh/) (this project uses `bun`)
*   [Python](https://www.python.org/) (version 3.X - *Specify version*) & `pip`
*   [LibreOffice](https://www.libreoffice.org/download/download-libreoffice/) installed and accessible in your PATH (for the `pptx-processor-service`).
*   A [Supabase](https://supabase.com/) project.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pptxTrans
```

### 2. Frontend Setup (Next.js)

*   Navigate to the root directory.
*   Create a `.env.local` file by copying `.env.example` (if it exists, otherwise create one) with your Supabase project URL and Anon key:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    # Add other environment variables as needed
    ```
*   Install dependencies:
    ```bash
    bun install
    ```
*   Run the development server:
    ```bash
    bun dev
    ```
    The application should be accessible at `http://localhost:3000`.

### 3. Backend Setup (PPTX Processor Service)

*   Navigate to the `pptx-processor-service` directory:
    ```bash
    cd pptx-processor-service
    ```
*   Create a Python virtual environment and activate it:
    ```bash
    python -m venv .venv
    # On Windows
    source .venv/Scripts/activate
    # On macOS/Linux
    source .venv/bin/activate
    ```
*   Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
*   Create a `.env` file in the `pptx-processor-service` directory with your Supabase details and any other necessary configurations:
    ```env
    SUPABASE_URL=your-supabase-url
    SUPABASE_KEY=your-supabase-service-role-key # Use the service_role key for backend operations
    # Add other environment variables as needed (e.g., for Celery, Redis if used)
    ```
*   Run the FastAPI server (ensure LibreOffice is installed and in PATH):
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```
    The processor service API should be accessible at `http://localhost:8000/docs`.

### 4. Supabase Setup

*   Ensure your Supabase project has the necessary tables created. Refer to `memory-bank/systemPatterns.md` for details on `translation_sessions`, `slides`, and `slide_shapes` tables.
*   Set up Row Level Security (RLS) policies as described in the project documentation.
*   Configure Supabase Storage buckets (e.g., `presentations`, `slide_visuals`).

## 📈 Project Status & Progress

(Refer to `memory-bank/progress.md` for the latest detailed progress.)

### What Works:
*   ✅ User Authentication (Login, Signup)
*   ✅ PPTX Processor Service (Standalone FastAPI service with LibreOffice SVG conversion, text extraction, Supabase integration)
*   ✅ Core Database Schema in Supabase
*   ✅ Basic Dashboard UI (fetching sessions)
*   ✅ New Session Upload Wizard UI (mock uploads)
*   ✅ Slide Editor:
    *   SVG background rendering.
    *   Interactive text overlays based on coordinates (mock data).
    *   Basic text editing dialog.

### Key Pending Areas:
*   ⏳ **Full Frontend-Processor Service Integration:** Connect `UploadWizard` to the service, handle processing status.
*   ⏳ **Slide Editor Enhancements:** Real data fetching, `SlideNavigator` with actual SVGs, improved text editing.
*   ⏳ **Collaboration Features:** Comments implementation.
*   ⏳ **Export Functionality:** PPTX reconstruction.
*   ⏳ UI Polish, error handling, and responsiveness.

## 🗺️ Project Structure

```
pptxTrans/
├── app/                     # Next.js App Router (Frontend)
│   ├── (auth)/              # Authentication pages (login, signup)
│   ├── (dashboard)/         # User dashboard, new session creation
│   ├── (editor)/            # Slide editor interface
│   ├── api/                 # Next.js API routes (if any, distinct from processor service)
│   └── layout.tsx           # Main app layout
├── components/              # Shared React components
│   ├── dashboard/
│   ├── editor/
│   └── ui/                  # shadcn/ui components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions, Supabase client setup
│   └── supabase/
├── memory-bank/             # Project documentation and context files (for Cursor AI)
├── pptx-processor-service/  # Python FastAPI backend for PPTX processing
│   ├── app/                 # FastAPI application code
│   │   ├── api/             # API endpoints
│   │   ├── core/            # Configuration, core logic
│   │   ├── models/          # Pydantic models
│   │   └── services/        # Business logic for processing
│   ├── .venv/               # Python virtual environment
│   ├── main.py              # FastAPI app entry point
│   └── requirements.txt     # Python dependencies
├── public/                  # Static assets for Next.js
├── styles/                  # Global styles
├── types/                   # TypeScript type definitions
├── .cursorrules             # Cursor AI project intelligence
├── .env.example             # Example environment variables
├── next.config.mjs          # Next.js configuration
├── package.json
├── tsconfig.json
└── README.md                # This file!
```

##🤝 Contributing

Details on contributing to this project will be added soon. (Placeholder)

##📜 License

This project is licensed under the [MIT License](LICENSE). (Placeholder - create a LICENSE file if needed) 