/**
 * Load classifications from YAML files into Supabase lookup tables
 * Run: deno run --allow-net --allow-read --allow-env scripts/load-classifications.ts
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { parse } from "jsr:@std/yaml@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Genre {
  Genre: string;
  Subgenre: string;
}

interface Trope {
  Genre: string;
  Tropes: string[];
}

interface SpiceLevel {
  Label: string;
  Description: string;
}

interface RecommendationSource {
  name: string;
  url: string;
  scope: string;
  categories: string[];
  priority: number;
}

interface ClassificationsData {
  Genres: Genre[];
  Spice_Levels: SpiceLevel[];
  Tropes: Trope[];
}

interface RecommendationSourcesData {
  recommendation_sources: {
    [tier: string]: {
      [category: string]: RecommendationSource[];
    };
  };
}

async function loadClassifications(): Promise<void> {
  console.log("📚 Loading classifications data...");

  // Read and parse classifications.yaml
  const classificationsText = await Deno.readTextFile("./project-specs/classifications.yaml");
  const data = parse(classificationsText) as ClassificationsData;

  // 1. Load Genres
  console.log("\n🏷️  Loading genres...");
  const genreMap = new Map<string, number>();
  const uniqueGenres = [...new Set(data.Genres.map((g) => g.Genre))];

  for (const genreName of uniqueGenres) {
    const { data: genre, error } = await supabase
      .from("genres")
      .insert({ name: genreName })
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to insert genre "${genreName}":`, error.message);
      continue;
    }

    genreMap.set(genreName, genre.id);
    console.log(`✅ Inserted genre: ${genreName} (id: ${genre.id})`);
  }

  // 2. Load Subgenres
  console.log("\n📂 Loading subgenres...");
  for (const item of data.Genres) {
    const genreId = genreMap.get(item.Genre);
    if (!genreId) {
      console.error(`❌ Genre not found: ${item.Genre}`);
      continue;
    }

    const { error } = await supabase
      .from("subgenres")
      .insert({ genre_id: genreId, name: item.Subgenre });

    if (error) {
      console.error(`❌ Failed to insert subgenre "${item.Subgenre}":`, error.message);
      continue;
    }

    console.log(`✅ Inserted subgenre: ${item.Genre} → ${item.Subgenre}`);
  }

  // 3. Load Tropes
  console.log("\n🎭 Loading tropes...");
  for (const item of data.Tropes) {
    const genreId = genreMap.get(item.Genre);
    if (!genreId) {
      console.error(`❌ Genre not found for tropes: ${item.Genre}`);
      continue;
    }

    for (const tropeName of item.Tropes) {
      const { error } = await supabase
        .from("tropes")
        .insert({ genre_id: genreId, name: tropeName });

      if (error && !error.message.includes("duplicate")) {
        console.error(`❌ Failed to insert trope "${tropeName}":`, error.message);
        continue;
      }
    }

    console.log(`✅ Inserted ${item.Tropes.length} tropes for genre: ${item.Genre}`);
  }

  // 4. Load Spice Levels
  console.log("\n🌶️  Loading spice levels...");
  for (const spiceLevel of data.Spice_Levels) {
    const { error } = await supabase
      .from("spice_levels")
      .insert({ label: spiceLevel.Label, description: spiceLevel.Description });

    if (error) {
      console.error(`❌ Failed to insert spice level "${spiceLevel.Label}":`, error.message);
      continue;
    }

    console.log(`✅ Inserted spice level: ${spiceLevel.Label}`);
  }

  console.log("\n✅ Classifications loaded successfully!");
}

async function loadRecommendationSources(): Promise<void> {
  console.log("\n📊 Loading recommendation sources...");

  const recSourcesText = await Deno.readTextFile("./project-specs/recommendation-sources.yaml");
  const data = parse(recSourcesText) as RecommendationSourcesData;

  let count = 0;
  for (const tier in data.recommendation_sources) {
    for (const category in data.recommendation_sources[tier]) {
      const sources = data.recommendation_sources[tier][category];

      for (const source of sources) {
        const { error } = await supabase.from("recommendation_sources").insert({
          name: source.name,
          url: source.url,
          scope: source.scope,
          categories: source.categories,
          priority: source.priority,
        });

        if (error) {
          console.error(`❌ Failed to insert source "${source.name}":`, error.message);
          continue;
        }

        count++;
        console.log(`✅ Inserted source: ${source.name} (priority: ${source.priority})`);
      }
    }
  }

  console.log(`\n✅ Loaded ${count} recommendation sources!`);
}

// Main execution
if (import.meta.main) {
  try {
    await loadClassifications();
    await loadRecommendationSources();
    console.log("\n🎉 All data loaded successfully!");
  } catch (error) {
    console.error("❌ Fatal error:", error);
    Deno.exit(1);
  }
}
