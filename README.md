# Webpage to Markdown Raycast Extension

A Raycast extension that converts webpages to clean, readable markdown files with options to remove non-content elements and download images locally.

![Preview](/Preview.png)

## Features

- 🌐 **URL to Markdown**: Convert any webpage to a markdown file
- 🧹 **Clean Content**: Automatically remove ads, navigation, and other non-content elements
- 🖼️ **Image Download**: Download images locally and update links in the markdown
- 📁 **Folder Picker**: Easy folder selection with native macOS dialog and recent folders
- 🏷️ **Metadata**: Automatically adds title, URL, and date metadata to files
- ⚙️ **Configurable**: Set default download directory and other preferences

## Usage

1. Open Raycast
2. Search for "Convert Webpage to Markdown"
3. Enter the URL you want to convert
4. Choose a filename and output directory
5. Toggle options for content cleaning and image downloading
6. Press Enter to convert

## Options

- **Remove non-content elements**: Uses Readability to extract just the main article content
- **Download images locally**: Downloads all images to an `images` subfolder and updates links

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development mode
4. Or run `npm run build` to build and install the extension

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build extension
npm run build

# Lint code
npm run lint
```

## Requirements

- Raycast
- Node.js 16+
- macOS

## License

MIT
