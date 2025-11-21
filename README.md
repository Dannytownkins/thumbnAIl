# ThumbnAIl Studio

A professional-grade AI powered YouTube thumbnail generator built with React and the Google Gemini API.

![ThumbnAIl Studio](./public/screenshot.png)

## Features

- **Concept Brainstorming**: Generate viral thumbnail ideas based on video topics using `gemini-2.5-flash`.
- **Style Analysis**: Upload an existing thumbnail to reverse-engineer its style for your own brand.
- **High-Fidelity Generation**: Creates high-resolution (2K) thumbnails using `gemini-3-pro-image-preview`.
- **Component Isolation**: Automatically splits generated images into layers (Background vs Subject) using standard chroma keying techniques and AI inpainting.
- **Canvas Editor**: Drag, drop, resize, and edit text/image layers directly in the browser.

## Setup & Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your Gemini API key:
   ```
   API_KEY=your_api_key_here
   ```
   *Note: The application handles API keys securely. Ensure your API key has billing enabled to use the Pro image models.*

4. Run the development server:
   ```bash
   npm run dev
   ```

## Tech Stack

- React 19
- Google GenAI SDK (`@google/genai`)
- Tailwind CSS
- Lucide React

## License

MIT
