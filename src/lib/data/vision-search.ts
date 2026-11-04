/**
 * Turns a photo into the same search intent a typed sentence uses.
 * Runs an open-source vision model through Ollama's OpenAI-compatible API.
 * Defaults to Ollama on this computer; set EXPO_PUBLIC_VISION_URL to your computer's
 * network address (e.g. http://192.168.1.20:11434) to use it from a phone.
 */
import {
  CATEGORIES,
  EVENTS,
  SIZES,
  type Category,
  type EventTag,
  type Size,
} from "./types";
import type { SearchIntent } from "./search";

const VISION_URL =
  process.env.EXPO_PUBLIC_VISION_URL ?? "http://localhost:11434";
const VISION_MODEL = process.env.EXPO_PUBLIC_VISION_MODEL ?? "qwen2.5vl:3b";
const UNAVAILABLE = "Photo search needs Ollama running (ollama serve).";

function asList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const found: T[] = [];
  for (const item of value) {
    if (
      typeof item === "string" &&
      (allowed as readonly string[]).includes(item) &&
      !found.includes(item as T)
    ) {
      found.push(item as T);
    }
  }
  return found;
}

/** One vision request. Throws a message that is safe to show. */
export async function describePhoto(
  base64: string,
  mimeType: string,
): Promise<SearchIntent> {
  const prompt = [
    "Look at this clothing photo and describe it for a college clothing-rental search.",
    `categories must be chosen from: ${CATEGORIES.join(", ")}.`,
    `events must be chosen from: ${EVENTS.join(", ")}.`,
    `sizes must be chosen from: ${SIZES.join(", ")}, or empty if you cannot tell.`,
    "words are a few color or style words, lowercase, no sentences.",
    'Reply with JSON only: {"categories":[],"events":[],"sizes":[],"words":[]}.',
  ].join(" ");

  let response: Response;
  try {
    response = await fetch(`${VISION_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error(UNAVAILABLE);
  }

  if (!response.ok) throw new Error(UNAVAILABLE);

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Photo search could not read that photo.");

  let parsed: {
    categories?: unknown;
    events?: unknown;
    sizes?: unknown;
    words?: unknown;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Photo search could not read that photo.");
  }

  return photoIntent(parsed);
}

/** Colors a photo search keeps. Listings mention colors, but rarely style words like "fitted". */
const COLORS = [
  "black",
  "white",
  "cream",
  "grey",
  "gray",
  "silver",
  "gold",
  "red",
  "burgundy",
  "pink",
  "orange",
  "yellow",
  "green",
  "emerald",
  "blue",
  "navy",
  "purple",
  "lilac",
  "brown",
  "tan",
  "khaki",
  "denim",
];

/**
 * Turns the model's description into search filters that will actually match listings. Every word
 * has to appear in a listing, so only one color is kept, and a guess at every size is dropped.
 */
export function photoIntent(parsed: {
  categories?: unknown;
  events?: unknown;
  sizes?: unknown;
  words?: unknown;
}): SearchIntent {
  const words = Array.isArray(parsed.words)
    ? parsed.words
        .filter((word): word is string => typeof word === "string")
        .map((word) => word.toLowerCase().trim())
    : [];
  const color = words.find((word) => COLORS.includes(word));
  const sizes = asList<Size>(parsed.sizes, SIZES);

  return {
    categories: asList<Category>(parsed.categories, CATEGORIES),
    events: asList<EventTag>(parsed.events, EVENTS),
    sizes: sizes.length <= 2 ? sizes : [],
    maxPrice: null,
    words: color ? [color] : [],
  };
}
