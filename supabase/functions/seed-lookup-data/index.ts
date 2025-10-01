// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { load } from "npm:js-yaml@4";

/**
 * Generate a unique request ID for traceability
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Structured logging helper
 */
function log(
  requestId: string,
  level: "info" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  const logEntry = {
    requestId,
    level,
    message,
    timestamp: new Date().toISOString(),
    context: context || {},
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * YAML data structure types
 */
interface GenreSubgenreEntry {
  Genre: string;
  Subgenre: string;
}

interface SpiceLevelEntry {
  Label: string;
  Description: string;
}

interface TropeEntry {
  Genre: string;
  Tropes: string[];
}

interface RecommendationSource {
  name: string;
  url: string;
  scope: string;
  categories: string[];
  priority: number;
}

interface ClassificationsYAML {
  Genres: GenreSubgenreEntry[];
  Spice_Levels: SpiceLevelEntry[];
  Tropes: TropeEntry[];
}

interface RecommendationSourcesYAML {
  recommendation_sources: {
    tier1_primary?: Record<string, RecommendationSource[]>;
    tier2_secondary?: Record<string, RecommendationSource[]>;
    tier3_extended?: Record<string, RecommendationSource[]>;
  };
}

/**
 * Load and seed genres and subgenres from YAML
 */
async function seedGenresAndSubgenres(
  supabase: ReturnType<typeof createClient>,
  genres: GenreSubgenreEntry[],
  requestId: string,
): Promise<{ genresInserted: number; subgenresInserted: number }> {
  let genresInserted = 0;
  let subgenresInserted = 0;

  // Group by genre
  const genreMap = new Map<string, string[]>();
  for (const entry of genres) {
    if (!genreMap.has(entry.Genre)) {
      genreMap.set(entry.Genre, []);
    }
    genreMap.get(entry.Genre)!.push(entry.Subgenre);
  }

  // Insert genres and subgenres
  for (const [genreName, subgenreNames] of genreMap.entries()) {
    // Upsert genre
    const { data: genreData, error: genreError } = await supabase
      .from("genres")
      .upsert({ name: genreName }, { onConflict: "name" })
      .select("id")
      .single();

    if (genreError) {
      log(requestId, "error", `Failed to upsert genre: ${genreName}`, { error: genreError });
      throw genreError;
    }

    genresInserted++;
    const genreId = genreData.id;

    // Upsert subgenres
    for (const subgenreName of subgenreNames) {
      const { error: subgenreError } = await supabase
        .from("subgenres")
        .upsert({ genre_id: genreId, name: subgenreName }, { onConflict: "genre_id,name" });

      if (subgenreError) {
        log(requestId, "error", `Failed to upsert subgenre: ${subgenreName}`, {
          error: subgenreError,
        });
        throw subgenreError;
      }

      subgenresInserted++;
    }
  }

  return { genresInserted, subgenresInserted };
}

/**
 * Load and seed spice levels from YAML
 */
async function seedSpiceLevels(
  supabase: ReturnType<typeof createClient>,
  spiceLevels: SpiceLevelEntry[],
  requestId: string,
): Promise<number> {
  let inserted = 0;

  for (const spiceLevel of spiceLevels) {
    const { error } = await supabase
      .from("spice_levels")
      .upsert(
        { label: spiceLevel.Label, description: spiceLevel.Description },
        { onConflict: "label" },
      );

    if (error) {
      log(requestId, "error", `Failed to upsert spice level: ${spiceLevel.Label}`, { error });
      throw error;
    }

    inserted++;
  }

  return inserted;
}

/**
 * Load and seed tropes from YAML
 */
async function seedTropes(
  supabase: ReturnType<typeof createClient>,
  tropes: TropeEntry[],
  requestId: string,
): Promise<number> {
  let inserted = 0;

  for (const tropeEntry of tropes) {
    // Get genre ID
    const { data: genreData, error: genreError } = await supabase
      .from("genres")
      .select("id")
      .eq("name", tropeEntry.Genre)
      .single();

    if (genreError || !genreData) {
      log(requestId, "error", `Genre not found for tropes: ${tropeEntry.Genre}`, {
        error: genreError,
      });
      continue;
    }

    const genreId = genreData.id;

    // Insert tropes for this genre
    for (const tropeName of tropeEntry.Tropes) {
      const { error } = await supabase
        .from("tropes")
        .upsert({ genre_id: genreId, name: tropeName }, { onConflict: "genre_id,name" });

      if (error) {
        log(requestId, "error", `Failed to upsert trope: ${tropeName}`, { error });
        throw error;
      }

      inserted++;
    }
  }

  return inserted;
}

/**
 * Load and seed recommendation sources from YAML
 */
async function seedRecommendationSources(
  supabase: ReturnType<typeof createClient>,
  recommendationSourcesData: RecommendationSourcesYAML,
  requestId: string,
): Promise<number> {
  let inserted = 0;

  const allSources: RecommendationSource[] = [];

  // Flatten all tiers and categories
  for (const tier of Object.values(recommendationSourcesData.recommendation_sources)) {
    if (tier) {
      for (const sources of Object.values(tier)) {
        allSources.push(...sources);
      }
    }
  }

  // Insert recommendation sources
  for (const source of allSources) {
    const { error } = await supabase.from("recommendation_sources").upsert(
      {
        name: source.name,
        url: source.url,
        scope: source.scope,
        categories: source.categories,
        priority: source.priority,
      },
      { onConflict: "name" },
    );

    if (error) {
      log(requestId, "error", `Failed to upsert recommendation source: ${source.name}`, { error });
      throw error;
    }

    inserted++;
  }

  return inserted;
}

/**
 * Main handler
 */
Deno.serve(async (_req: Request) => {
  const requestId = generateRequestId();
  log(requestId, "info", "Seed lookup data function invoked");

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Read YAML files
    log(requestId, "info", "Reading YAML files");

    const classificationsYamlPath = "./project-specs/classifications.yaml";
    const recommendationSourcesYamlPath = "./project-specs/recommendation-sources.yaml";

    const classificationsYamlText = await Deno.readTextFile(classificationsYamlPath);
    const recommendationSourcesYamlText = await Deno.readTextFile(recommendationSourcesYamlPath);

    // Parse YAML
    log(requestId, "info", "Parsing YAML files");
    const classificationsData = load(classificationsYamlText) as ClassificationsYAML;
    const recommendationSourcesData = load(
      recommendationSourcesYamlText,
    ) as RecommendationSourcesYAML;

    // Validate YAML structure
    if (
      !classificationsData.Genres ||
      !classificationsData.Spice_Levels ||
      !classificationsData.Tropes
    ) {
      throw new Error("Invalid classifications.yaml structure");
    }

    if (!recommendationSourcesData.recommendation_sources) {
      throw new Error("Invalid recommendation-sources.yaml structure");
    }

    // Seed data
    log(requestId, "info", "Seeding genres and subgenres");
    const { genresInserted, subgenresInserted } = await seedGenresAndSubgenres(
      supabase,
      classificationsData.Genres,
      requestId,
    );

    log(requestId, "info", "Seeding spice levels");
    const spiceLevelsInserted = await seedSpiceLevels(
      supabase,
      classificationsData.Spice_Levels,
      requestId,
    );

    log(requestId, "info", "Seeding tropes");
    const tropesInserted = await seedTropes(supabase, classificationsData.Tropes, requestId);

    log(requestId, "info", "Seeding recommendation sources");
    const recommendationSourcesInserted = await seedRecommendationSources(
      supabase,
      recommendationSourcesData,
      requestId,
    );

    // Return summary
    const summary = {
      success: true,
      genresInserted,
      subgenresInserted,
      spiceLevelsInserted,
      tropesInserted,
      recommendationSourcesInserted,
    };

    log(requestId, "info", "Seed lookup data completed successfully", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log(requestId, "error", "Seed lookup data failed", { error: String(error) });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
