# Project Brief: PowerPoint Translator App Frontend MVP

## 1. Application Overview
The project is to create a modern, intuitive web application frontend for translating PowerPoint (PPTX) presentations. This Minimum Viable Product (MVP) will focus on core translation functionalities, collaboration through comments, and preserving the original formatting as much as possible.

## 2. Core Goal
Enable users to efficiently upload, translate text content within, and export PowerPoint presentations while maintaining visual fidelity and facilitating collaboration.

## 3. Key Features
- **User Authentication:** Secure login and signup.
- **Dashboard:** Manage translation sessions, view progress, and initiate actions.
- **PPTX Upload & Configuration:** Multi-step wizard to upload PPTX files, name sessions, and select source/target languages.
- **Slide Editor:**
    - High-fidelity visual representation of slides (via server-side SVG conversion).
    - Interactive text elements overlaid on slide images for translation.
    - Slide navigator with thumbnails.
    - Comments panel for collaboration.
- **Text Editing Interface:** Popup or inline editor for translating text chunks, showing original and translated text.
- **Comments & Collaboration:** Attach comments to text elements, reply, and resolve.
- **Export:** Export the translated presentation (conceptual: reconstructing a PPTX with translated text).

## 4. Target Technology Stack
- **Frontend:** Next.js 14 (App Router), React, TypeScript.
- **Styling:** Tailwind CSS, shadcn/ui components.
- **Backend-as-a-Service (BaaS):** Supabase (Authentication, PostgreSQL Database, Storage).
- **Slide Processing (Conceptual):** Server-side solution for PPTX to SVG conversion and text/layout extraction.
- **PPTX Generation (Conceptual for Export):** PptxGenJS or similar.

## 5. Design System & UX
- **Interface:** Clean, professional, intuitive, with subtle animations.
- **Primary Color:** Blue (#3B82F6)
- **Font:** Inter
- **Layout:** Desktop-first (min-width 1280px), with basic tablet support.
- **User Experience:** Focus on productivity, efficiency, and a seamless translation workflow.
