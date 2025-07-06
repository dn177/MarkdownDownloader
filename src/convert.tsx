import React from "react";
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
  showInFinder,
  popToRoot,
  open,
} from "@raycast/api";
import { useForm, FormValidation } from "@raycast/utils";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import TurndownService from "turndown";
import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import { 
  sanitizeFilename, 
  generateFilenameFromTitle, 
  ensureUniqueFilename,
  extractDomain,
  handleError 
} from "./utils";
import { Preferences } from "./preferences";
import { selectFolder, getRecentFolders, addRecentFolder } from "./folder-picker";

interface FormValues {
  url: string;
  removeNonContent: boolean;
  downloadImages: boolean;
  outputPath: string;
  filename: string;
  autoGenerateFilename: boolean;
  openAfterConversion: boolean;
  cleanAffiliateLinks: boolean;
  aggressiveCleanup: boolean;
}

export default function ConvertWebpage() {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedFilename, setSuggestedFilename] = useState("");
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const preferences = getPreferenceValues<Preferences>();

  const { handleSubmit, itemProps, values, setValue } = useForm<FormValues>({
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        await convertWebpageToMarkdown(values);
      } catch (error) {
        await handleError(error, "Webpage Conversion");
      } finally {
        setIsLoading(false);
      }
    },
    validation: {
      url: FormValidation.Required,
      outputPath: (value) => {
        if (!value || value === "custom") {
          return "Please select an output folder";
        }
      },
      filename: (value) => {
        if (!values.autoGenerateFilename && !value) {
          return "Filename is required when auto-generate is disabled";
        }
      },
    },
    initialValues: {
      outputPath: preferences.defaultOutputPath || path.join(process.env.HOME || "", "Downloads"),
      removeNonContent: true,
      downloadImages: true,
      autoGenerateFilename: true,
      openAfterConversion: preferences.autoOpenFile || false,
      cleanAffiliateLinks: true,
      aggressiveCleanup: true,
    },
  });

  // Load recent folders on mount
  useEffect(() => {
    loadRecentFolders();
  }, []);

  // Handle custom folder selection
  useEffect(() => {
    if (values.outputPath === "custom") {
      handleSelectFolder();
    }
  }, [values.outputPath]);

  // Update suggested filename when URL changes
  useEffect(() => {
    if (values.url && values.autoGenerateFilename) {
      try {
        const url = new URL(values.url);
        const domain = extractDomain(values.url);
        const pathParts = url.pathname.split("/").filter(p => p);
        const lastPart = pathParts[pathParts.length - 1] || domain;
        const cleanName = sanitizeFilename(lastPart.replace(/\.\w+$/, ""));
        setSuggestedFilename(`${cleanName}.md`);
      } catch {
        setSuggestedFilename("webpage.md");
      }
    }
  }, [values.url, values.autoGenerateFilename]);

  async function loadRecentFolders() {
    const folders = await getRecentFolders();
    setRecentFolders(folders);
  }

  async function handleSelectFolder() {
    const selectedFolder = await selectFolder();
    
    if (selectedFolder) {
      setValue("outputPath", selectedFolder);
      await addRecentFolder(selectedFolder);
      await loadRecentFolders();
      
      await showToast({
        style: Toast.Style.Success,
        title: "Folder Selected",
        message: path.basename(selectedFolder),
      });
    } else {
      // User cancelled - reset to default folder
      setValue("outputPath", preferences.defaultOutputPath || path.join(process.env.HOME || "", "Downloads"));
    }
  }

  async function convertWebpageToMarkdown(values: FormValues) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Converting webpage...",
    });

    // Validate URL
    try {
      new URL(values.url);
    } catch {
      throw new Error("Invalid URL provided");
    }

    // Fetch the webpage
    toast.message = "Fetching webpage...";
    const response = await fetch(values.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const baseUrl = new URL(values.url);

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Clean HTML
    toast.message = "Processing content...";
    let cleanedHtml = html;
    if (values.removeNonContent) {
      // Simple content extraction - remove common non-content elements
      cleanedHtml = cleanedHtml
        // Remove scripts and styles
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
        // Remove common navigation and footer elements
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
        .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
        // Remove ads and tracking
        .replace(/<div[^>]*class="[^"]*(?:ads?|advertisement|banner|sponsor|promo|widget|sidebar)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
        // Remove social media widgets
        .replace(/<div[^>]*class="[^"]*(?:social|share|twitter|facebook|linkedin)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
        // Remove newsletter signup forms
        .replace(/<form[^>]*(?:newsletter|subscribe|signup)[^>]*>[\s\S]*?<\/form>/gi, "")
        // Remove comments sections
        .replace(/<div[^>]*(?:id|class)="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
        // Remove speechify-ignore elements (Medium specific)
        .replace(/<[^>]+class="[^"]*speechify-ignore[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, "")
        // Remove Medium-specific newsletter headers
        .replace(/<div[^>]*class="[^"]*(?:newsletter|publication-header)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
        // Remove author info sections at the beginning
        .replace(/<div[^>]*>[\s\S]*?Sent as a\s*Newsletter[\s\S]*?<\/div>/gi, "")
        // Remove "min read" metadata
        .replace(/<[^>]*>\s*\d+\s*min\s*read\s*<\/[^>]*>/gi, "");

      // Try to extract main content
      const mainContentPatterns = [
        /<main\b[^>]*>([\s\S]*?)<\/main>/i,
        /<article\b[^>]*>([\s\S]*?)<\/article>/i,
        // Medium-specific patterns
        /<div[^>]*class="[^"]*section-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*postArticle-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        // Generic patterns
        /<div[^>]*(?:class|id)="[^"]*(?:content|main|body|post|entry|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*role="main"[^>]*>([\s\S]*?)<\/div>/i,
      ];

      for (const pattern of mainContentPatterns) {
        const match = cleanedHtml.match(pattern);
        if (match && match[1]) {
          cleanedHtml = match[1];
          break;
        }
      }
    }

    // Create output directory
    await fs.ensureDir(values.outputPath);
    
    // Save to recent folders
    await addRecentFolder(values.outputPath);

    // Process images if needed
    let imagesFolder: string | null = null;
    if (values.downloadImages) {
      toast.message = "Processing images...";
      const imageData = await processImagesSimple(
        cleanedHtml,
        baseUrl,
        values.outputPath,
        sanitizeFilename(title)
      );
      if (imageData) {
        cleanedHtml = imageData.html;
        imagesFolder = imageData.folder;
      }
    }

    // Convert to markdown
    toast.message = "Converting to markdown...";
    const turndownService = createTurndownService(values.cleanAffiliateLinks);
    const content = turndownService.turndown(cleanedHtml);
    // Generate filename
    let filename: string;
    if (values.autoGenerateFilename) {
      filename = generateFilenameFromTitle(title);
    } else {
      filename = values.filename.endsWith(".md") 
        ? values.filename 
        : `${values.filename}.md`;
    }
    
    let outputFile = path.join(values.outputPath, filename);
    outputFile = await ensureUniqueFilename(outputFile);

    // Add metadata header
    const metadata = `---
title: ${title}
url: ${values.url}
date: ${new Date().toISOString()}
domain: ${extractDomain(values.url)}
${imagesFolder ? `images_folder: ${path.basename(imagesFolder)}` : ""}
---

# ${title}

`;

    // Clean up the content
    let cleanContent = content
      .replace(/\n{3,}/g, "\n\n") // Remove excessive newlines
      .replace(/\[[\s\n]*\]\([^)]+\)/g, "") // Remove empty links
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Clean up whitespace between paragraphs
      .replace(/^\s+/gm, "") // Remove leading whitespace from lines
      .replace(/\s+$/gm, "") // Remove trailing whitespace from lines
      .replace(/\[\s*\n\s*\]/g, "[]") // Fix broken link syntax
      .trim();
      
    if (values.aggressiveCleanup) {
      // Apply more aggressive cleanup for Medium and similar sites
      cleanContent = cleanContent
        // Fix broken Medium links
        .replace(/(\w+\.com)\]\([^)]+\)/g, "$1") // Fix domain.com](url) patterns
        .replace(/Link\s*--\s*Link/g, "") // Remove duplicate "Link" text
        .replace(/^[\s\S]*?(Hello\s+(?:guys|folks|everyone|readers|friends|there))/im, "$1") // Remove everything before article greeting
        .replace(/Sent as a\s*Newsletter.*?·.*?·.*?Link/g, "") // Remove newsletter metadata
        .replace(/\w+\s+·\s+\d+\s+min\s+read\s+·\s+\w+\s+\d+,\s+\d+/g, "") // Remove reading time metadata
        .replace(/^[^\n]*Newsletter[^\n]*\n/gm, "") // Remove lines containing Newsletter
        // Clean up author metadata at the beginning
        .replace(/^[A-Za-z0-9_]+\s+(·|-|—)\s+Follow\s*\n/gm, "")
        .replace(/^Follow\s*\n/gm, "")
        // Remove standalone author names at the beginning
        .replace(/^[a-z][a-z0-9_]+\s*\n/gm, "")
        // Clean up broken Medium URLs
        .replace(/\[([^\]]+)\]\([^)]*source=post_page[^)]*\)/g, "[$1]")
        .replace(/\n\s*\n\s*\n/g, "\n\n");
    }
    
    // Remove duplicate title if it appears at the beginning of content
    const titlePattern = new RegExp(`^#?\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`, 'i');
    cleanContent = cleanContent.replace(titlePattern, '');
    
    const finalContent = cleanContent.trim();

    // Write the markdown file
    await fs.writeFile(outputFile, metadata + finalContent);

    toast.style = Toast.Style.Success;
    toast.title = "Conversion Complete";
    toast.message = `Saved to ${path.basename(outputFile)}`;
    toast.primaryAction = {
      title: "Show in Finder",
      onAction: () => {
        showInFinder(outputFile);
      },
    };
    toast.secondaryAction = {
      title: "Open File",
      onAction: () => {
        open(outputFile);
      },
    };

    if (values.openAfterConversion) {
      await open(outputFile);
    }

    await popToRoot();
  }

  async function processImagesSimple(
    html: string,
    baseUrl: URL,
    outputPath: string,
    folderPrefix: string
  ): Promise<{ html: string; folder: string } | null> {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const images: { match: string; src: string }[] = [];
    
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      images.push({ match: match[0], src: match[1] });
    }

    if (images.length === 0) return null;
    const timestamp = new Date().toISOString().split("T")[0];
    const imageDir = path.join(outputPath, `${folderPrefix}-images-${timestamp}`);
    await fs.ensureDir(imageDir);

    let modifiedHtml = html;
    let downloadedCount = 0;

    for (const img of images) {
      try {
        const imageUrl = new URL(img.src, baseUrl);
        
        // Skip data URLs and invalid protocols
        if (imageUrl.protocol === "data:" || 
            (!imageUrl.protocol.startsWith("http") && 
             !imageUrl.protocol.startsWith("https"))) {
          continue;
        }

        // Download image
        const response = await fetch(imageUrl.href, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });
        
        if (!response.ok) continue;

        const buffer = await response.buffer();
        
        // Determine file extension
        const contentType = response.headers.get("content-type");
        let ext = path.extname(imageUrl.pathname) || "";
        
        if (!ext && contentType) {
          const typeMap: Record<string, string> = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
          };
          ext = typeMap[contentType] || ".jpg";
        } else if (!ext) {
          ext = ".jpg";
        }
        
        // Generate unique filename
        const hash = crypto.createHash("md5").update(imageUrl.href).digest("hex").substring(0, 8);
        const altMatch = img.match.match(/alt="([^"]*)"/i);
        const imgTitle = altMatch ? altMatch[1] : "image";
        const cleanTitle = sanitizeFilename(imgTitle).substring(0, 50);
        const filename = `${cleanTitle}-${hash}${ext}`;
        const localPath = path.join(imageDir, filename);

        // Save image
        await fs.writeFile(localPath, buffer);
        downloadedCount++;

        // Update image src in HTML
        const relativePath = `${path.basename(imageDir)}/${filename}`;
        const newImgTag = img.match.replace(img.src, relativePath);
        modifiedHtml = modifiedHtml.replace(img.match, newImgTag);
      } catch (error) {
        console.error(`Failed to download image ${img.src}:`, error);
      }
    }

    return downloadedCount > 0 ? { html: modifiedHtml, folder: imageDir } : null;
  }
  function createTurndownService(cleanAffiliateLinks: boolean = true): TurndownService {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
    });

    // Remove unwanted elements
    turndownService.remove([
      "script",
      "noscript",
      "style",
      "meta",
      "link",
      "iframe",
      "object",
      "embed",
      "button",
      "form",
      "input",
      "select",
      "textarea",
    ]);
    
    // Also remove svg separately since it's not in the standard list
    turndownService.remove("svg" as any);
    
    // Remove elements by class
    turndownService.addRule("removeByClass", {
      filter: function (node) {
        if (node.nodeType !== 1) return false; // Only element nodes
        const element = node as Element;
        const classes = element.getAttribute("class") || "";
        return classes.includes("speechify-ignore") || 
               classes.includes("newsletter") ||
               classes.includes("social-share") ||
               classes.includes("author-info") ||
               classes.includes("publication-info");
      },
      replacement: function () {
        return "";
      }
    });

    // Custom rule for links to handle empty or whitespace-only link text
    turndownService.addRule("links", {
      filter: "a",
      replacement: function (content, node) {
        const element = node as Element;
        const href = element.getAttribute("href");
        if (!href) return content;
        
        // Clean up the link text
        const linkText = content.trim();
        
        // Skip empty links or links with only whitespace
        if (!linkText || linkText === "") {
          // Try to get text from title or aria-label
          const title = element.getAttribute("title") || element.getAttribute("aria-label");
          if (title) {
            return `[${title}](${href})`;
          }
          // If it's an image-only link, return empty string to avoid broken markdown
          if (element.querySelector("img")) {
            return "";
          }
          // For other empty links, use the domain name as link text
          try {
            const url = new URL(href);
            return `[${url.hostname}](${href})`;
          } catch {
            return `[Link](${href})`;
          }
        }
        
        // Handle affiliate/tracking links by cleaning them up
        if (cleanAffiliateLinks) {
          // Various affiliate link patterns
          const affiliatePatterns = [
            /murl=([^&]+)/, // LinkSynergy
            /url=([^&]+)/, // Generic URL parameter
            /redirect=([^&]+)/, // Redirect parameter
            /destination=([^&]+)/, // Destination parameter
            /target=([^&]+)/, // Target parameter
          ];
          
          // Check if it's an affiliate/tracking link
          if (href.includes("linksynergy") || 
              href.includes("click.") || 
              href.includes("track.") ||
              href.includes("redirect") ||
              href.includes("affiliate")) {
            
            // Try each pattern to extract the actual URL
            for (const pattern of affiliatePatterns) {
              const match = href.match(pattern);
              if (match) {
                try {
                  const decodedUrl = decodeURIComponent(match[1]);
                  // Validate it's a proper URL
                  new URL(decodedUrl);
                  return `[${linkText}](${decodedUrl})`;
                } catch {
                  // If decoding fails, continue to next pattern
                }
              }
            }
          }
        }
        
        // Fix broken link syntax (especially Medium)
        let cleanHref = href;
        
        if (linkText.endsWith(".com") && href.includes("source=post_page")) {
          // Medium often has broken links like "medium.com](url?source=...)"
          return linkText; // Just return the domain without link
        }
        
        // Clean up Medium tracking parameters
        if (href.includes("medium.com")) {
          cleanHref = href.replace(/\?source=.*$/, ""); // Remove tracking parameters
        }
        
        return `[${linkText}](${cleanHref})`;
      }
    });

    // Handle code blocks
    turndownService.addRule("fencedCodeBlock", {
      filter: function (node) {
        return (
          node.nodeName === "PRE" &&
          node.firstChild !== null &&
          node.firstChild.nodeName === "CODE"
        );
      },
      replacement: function (content, node) {
        const element = node as Element;
        const codeNode = element.firstChild as Element;
        const className = codeNode.getAttribute("class") || "";
        const language = className.match(/language-(\S+)/)?.[1] || "";
        
        return "\n\n```" + language + "\n" + codeNode.textContent + "\n```\n\n";
      },
    });

    // Handle images with better alt text
    turndownService.addRule("images", {
      filter: "img",
      replacement: function (content, node) {
        const element = node as Element;
        const alt = element.getAttribute("alt") || "";
        const src = element.getAttribute("src") || "";
        const title = element.getAttribute("title");
        
        if (!src) return "";
        
        // Clean up alt text
        const cleanAlt = alt.trim() || "image";
        
        let markdown = `![${cleanAlt}](${src}`;
        if (title) {
          markdown += ` "${title}"`;
        }
        markdown += ")";
        
        return markdown;
      }
    });

    return turndownService;
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert to Markdown" onSubmit={handleSubmit} />
          {values.outputPath === "custom" && (
            <Action
              title="Select Folder"
              icon="📁"
              onAction={handleSelectFolder}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          <Action.OpenInBrowser url="https://github.com/danielmarass/webpage-to-markdown" />
        </ActionPanel>
      }
    >
      <Form.TextField
        title="URL"
        placeholder="https://example.com/article"
        info="The webpage URL to convert to markdown"
        {...itemProps.url}
      />
      
      <Form.Checkbox
        label="Auto-generate filename from title"
        info="Automatically create a filename based on the page title"
        {...itemProps.autoGenerateFilename}
      />
      
      {!values.autoGenerateFilename && (
        <Form.TextField
          title="Filename"
          placeholder={suggestedFilename || "article.md"}
          info="Name for the markdown file (extension will be added automatically)"
          {...itemProps.filename}
        />
      )}
      
      <Form.Dropdown
        title="Output Folder"
        info="Select a recent folder or choose 'Select Folder...' to browse"
        {...itemProps.outputPath}
      >
        <Form.Dropdown.Item value={preferences.defaultOutputPath || path.join(process.env.HOME || "", "Downloads")} title="Default Folder" />
        {recentFolders.map((folder, index) => (
          <Form.Dropdown.Item 
            key={index} 
            value={folder} 
            title={path.basename(folder)} 
          />
        ))}
        <Form.Dropdown.Item value="custom" title="Select Folder..." icon="📁" />
      </Form.Dropdown>
      
      {values.outputPath === "custom" && (
        <Form.Description text="Select a folder using the dialog that appears" />
      )}
      
      <Form.Separator />
      
      <Form.Description text="Conversion Options" />
      
      <Form.Checkbox
        label="Remove non-content elements"
        info="Extract only the main article content, removing ads, navigation, etc."
        {...itemProps.removeNonContent}
      />
      
      <Form.Checkbox
        label="Download images locally"
        info="Download all images and update links to local files"
        {...itemProps.downloadImages}
      />
      
      <Form.Checkbox
        label="Clean affiliate links"
        info="Extract actual URLs from tracking and affiliate links"
        {...itemProps.cleanAffiliateLinks}
      />
      
      <Form.Checkbox
        label="Aggressive cleanup"
        info="Remove author metadata, newsletter headers, and fix broken links (recommended for Medium)"
        {...itemProps.aggressiveCleanup}
      />
      
      <Form.Checkbox
        label="Open file after conversion"
        info="Automatically open the markdown file in your default editor"
        {...itemProps.openAfterConversion}
      />
    </Form>
  );
}