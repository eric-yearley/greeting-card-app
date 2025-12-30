import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
    console.error("Error: GOOGLE_API_KEY not set in .env file");
    console.error("1. Copy .env.example to .env");
    console.error("2. Add your API key from https://aistudio.google.com/apikey");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Occasion-specific prompt configurations
const occasionConfigs = {
    christmas: {
        name: 'Christmas',
        scene: 'magical snowy winter scene with Christmas trees, warm golden lights, falling snow, festive decorations',
        interior: 'cozy Christmas interior with fireplace, decorated tree, warm lighting, stockings',
        attire: 'festive winter clothing (sweater, scarf, Santa hat optional)',
        decorations: 'holly, ornaments, snowflakes, candy canes',
        defaultTitle: 'Merry Christmas'
    },
    birthday: {
        name: 'Birthday',
        scene: 'festive celebration scene with colorful balloons, confetti, streamers, party decorations',
        interior: 'cheerful party setting with birthday cake, presents, colorful banners',
        attire: 'party attire with optional birthday hat',
        decorations: 'balloons, confetti, streamers, stars',
        defaultTitle: 'Happy Birthday'
    },
    valentines: {
        name: "Valentine's Day",
        scene: 'romantic setting with hearts, roses, soft pink and red colors, dreamy atmosphere',
        interior: 'romantic interior with roses, candles, hearts, soft lighting',
        attire: 'elegant romantic attire in red, pink, or white',
        decorations: 'hearts, roses, cupid arrows, ribbons',
        defaultTitle: "Happy Valentine's Day"
    },
    thanksgiving: {
        name: 'Thanksgiving',
        scene: 'warm autumn harvest scene with fall foliage, pumpkins, golden light, rustic charm',
        interior: 'cozy dining setting with harvest decorations, autumn colors, warm ambiance',
        attire: 'comfortable autumn attire in warm colors',
        decorations: 'autumn leaves, pumpkins, cornucopia, wheat',
        defaultTitle: 'Happy Thanksgiving'
    },
    newyear: {
        name: 'New Year',
        scene: 'glamorous celebration scene with fireworks, sparklers, midnight sky, gold and silver accents',
        interior: 'elegant party setting with champagne, clock striking midnight, glittering decorations',
        attire: 'elegant party attire, festive accessories',
        decorations: 'fireworks, stars, clocks, champagne glasses, confetti',
        defaultTitle: 'Happy New Year'
    },
    easter: {
        name: 'Easter',
        scene: 'bright spring garden with blooming flowers, Easter eggs, soft pastel colors, gentle sunshine',
        interior: 'cheerful spring interior with Easter basket, decorated eggs, spring flowers',
        attire: 'spring attire in pastel colors',
        decorations: 'Easter eggs, bunnies, spring flowers, butterflies',
        defaultTitle: 'Happy Easter'
    },
    hanukkah: {
        name: 'Hanukkah',
        scene: 'warm celebration scene with menorah glow, blue and silver colors, Star of David, candlelight',
        interior: 'festive interior with lit menorah, dreidels, gelt, blue and white decorations',
        attire: 'elegant attire in blue, white, or silver',
        decorations: 'menorah, dreidels, Star of David, candles',
        defaultTitle: 'Happy Hanukkah'
    },
    general: {
        name: 'Special Occasion',
        scene: 'beautiful celebratory scene with elegant decorations, warm lighting, festive atmosphere',
        interior: 'elegant interior with tasteful decorations, warm and inviting ambiance',
        attire: 'nice attire appropriate for a special occasion',
        decorations: 'elegant borders, stars, flourishes',
        defaultTitle: 'Warm Wishes'
    }
};

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(join(__dirname, "public")));

// Generate greeting card from photo
app.post("/api/generate-card", async (req, res) => {
    try {
        const {
            selfieBase64,
            recipientName = "",
            senderName = "",
            greeting = "",
            customInstructions = "",
            occasion = "christmas",
            model = "gemini-2.5-flash-image"
        } = req.body;

        if (!selfieBase64) {
            return res.status(400).json({ error: "Photo is required" });
        }

        const config = occasionConfigs[occasion] || occasionConfigs.general;
        const defaultGreeting = greeting || `Wishing you a wonderful ${config.name}!`;

        console.log(`Generating ${config.name} card for ${recipientName || "recipient"}...`);
        console.log(`Model: ${model}`);

        // Remove data URL prefix if present
        const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, "");

        // Dynamic card prompt for UV-mappable flat layout
        const cardPrompt = `IMPORTANT: You MUST include ALL people visible in the uploaded photo. Preserve EVERY person's exact face, appearance, and features. Do NOT leave anyone out. Do NOT generate different people.

Create a ${config.name} card layout as a FLAT 2:1 wide image (texture atlas for 3D UV mapping).

ABSOLUTE REQUIREMENTS:
1. INCLUDE EVERYONE - ALL people from the uploaded photo must appear in the card
2. PRESERVE FACES - Each person's exact face, hair, and features must match the uploaded photo
3. FLAT IMAGE - No 3D perspective, no fold lines, completely flat like a printed poster
4. TWO EQUAL HALVES - Left half is front cover, right half is inside

LEFT HALF (FRONT COVER):
- Feature ALL THE SAME PEOPLE from the uploaded photo together in a ${config.scene}
- Keep everyone's exact faces and features - just enhance the setting
- Dress them in ${config.attire}
- Arrange the people naturally as a group/family portrait
- Text at top: "${config.defaultTitle}"${recipientName ? ` and "Dear ${recipientName}"` : ""}

RIGHT HALF (INSIDE OF CARD):
- ${config.interior}
- Include this greeting text: "${defaultGreeting}"
${senderName ? `- At bottom: "With love, ${senderName}"` : ""}
- Decorative borders with ${config.decorations}

STYLE: Beautiful ${config.name} colors and atmosphere, photorealistic integration of ALL people, professional greeting card quality.

CRITICAL: Include EVERY person from the photo - do not omit anyone. This is a family/group card.${customInstructions ? `

SPECIAL INSTRUCTIONS FROM USER (follow these carefully):
${customInstructions}` : ''}`;

        const response = await ai.models.generateContent({
            model,
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64Data
                            }
                        },
                        { text: cardPrompt }
                    ]
                }
            ],
            config: {
                responseModalities: ["IMAGE"],
                imageGenerationConfig: {
                    aspectRatio: "2:1"
                }
            }
        });

        // Extract image from response
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                console.log("Christmas card generated successfully!");
                return res.json({
                    success: true,
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                });
            }
        }

        console.error("No image in response");
        res.status(500).json({ error: "No image generated" });

    } catch (error) {
        console.error("Generation error:", error.message);
        res.status(500).json({ error: error.message || "Failed to generate card" });
    }
});

// Edit existing card
app.post("/api/edit-card", async (req, res) => {
    try {
        const {
            cardBase64,
            editInstructions,
            model = "gemini-2.5-flash-image"
        } = req.body;

        if (!cardBase64) {
            return res.status(400).json({ error: "Card image is required" });
        }

        if (!editInstructions) {
            return res.status(400).json({ error: "Edit instructions are required" });
        }

        console.log(`Editing card: "${editInstructions.substring(0, 50)}..."`);
        console.log(`Model: ${model}`);

        // Remove data URL prefix if present
        const base64Data = cardBase64.replace(/^data:image\/\w+;base64,/, "");

        const editPrompt = `This is an existing Christmas card image. Please modify it according to these instructions while keeping everything else the same:

EDIT REQUEST: ${editInstructions}

IMPORTANT:
- Keep the same overall layout (left half = front cover, right half = inside)
- Preserve all people's faces and appearances exactly as they are
- Only change what is specifically requested
- Maintain the flat 2:1 aspect ratio for UV mapping
- Keep text readable and properly positioned`;

        const response = await ai.models.generateContent({
            model,
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64Data
                            }
                        },
                        { text: editPrompt }
                    ]
                }
            ],
            config: {
                responseModalities: ["IMAGE"],
                imageGenerationConfig: {
                    aspectRatio: "2:1"
                }
            }
        });

        // Extract image from response
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                console.log("Card edited successfully!");
                return res.json({
                    success: true,
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                });
            }
        }

        console.error("No image in response");
        res.status(500).json({ error: "No image generated" });

    } catch (error) {
        console.error("Edit error:", error.message);
        res.status(500).json({ error: error.message || "Failed to edit card" });
    }
});

// Legacy generate endpoint (kept for compatibility)
app.post("/api/generate", async (req, res) => {
    try {
        const {
            prompt,
            model = "gemini-2.5-flash-image",
            aspectRatio = "1:1",
            imageSize
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        console.log(`Generating image: "${prompt.substring(0, 50)}..."`);
        console.log(`Model: ${model}, Aspect: ${aspectRatio}`);

        const config = {
            responseModalities: ["IMAGE"],
            imageGenerationConfig: {
                aspectRatio
            }
        };

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                console.log("Image generated successfully");
                return res.json({
                    success: true,
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                });
            }
        }

        console.error("No image in response");
        res.status(500).json({ error: "No image generated" });

    } catch (error) {
        console.error("Generation error:", error.message);
        res.status(500).json({ error: error.message || "Failed to generate image" });
    }
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", model: "Greeting Card Generator ready" });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║      ✨ Greeting Card Generator ✨                   ║
╠══════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}             ║
║  API endpoints:                                      ║
║    POST /api/generate-card - Generate greeting card  ║
║    POST /api/edit-card     - Edit existing card      ║
╚══════════════════════════════════════════════════════╝
    `);
});
