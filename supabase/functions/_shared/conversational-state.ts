/**
 * Conversational state management for multi-turn interactions
 * @module conversational-state
 */

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ConversationalState {
  id?: string;
  chat_id: number;
  current_context?: string;
  last_book_id?: string;
  last_interaction: string;
  state_data: StateData;
}

export interface StateData {
  workflow?: "add_book";
  step?: "awaiting_clarification" | "selecting_book";
  extracted_title?: string;
  extracted_author?: string;
  search_results?: Array<{
    title: string;
    author: string;
    isbn?: string;
    cover_image_url?: string;
    goodreads_id?: number;
  }>;
  [key: string]: unknown;
}

const STATE_TIMEOUT_MINUTES = 15;

/**
 * Save or update conversational state for a chat
 */
export async function saveState(
  supabase: SupabaseClient,
  chatId: number,
  stateData: StateData,
  context?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate state data structure
    if (!stateData || typeof stateData !== "object") {
      return { success: false, error: "Invalid state data structure" };
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + STATE_TIMEOUT_MINUTES);

    const { error } = await supabase.from("conversational_state").upsert(
      {
        chat_id: chatId,
        current_context: context,
        last_interaction: new Date().toISOString(),
        state_data: stateData,
      },
      {
        onConflict: "chat_id",
      },
    );

    if (error) {
      console.error("Failed to save conversational state:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving conversational state:", error);
    return { success: false, error: "Failed to save state" };
  }
}

/**
 * Retrieve conversational state for a chat
 */
export async function getState(
  supabase: SupabaseClient,
  chatId: number,
): Promise<ConversationalState | null> {
  try {
    const { data, error } = await supabase
      .from("conversational_state")
      .select("*")
      .eq("chat_id", chatId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No state found, not an error
        return null;
      }
      console.error("Failed to retrieve conversational state:", error);
      return null;
    }

    // Check if state has expired
    const lastInteraction = new Date(data.last_interaction);
    const now = new Date();
    const minutesSinceLastInteraction = (now.getTime() - lastInteraction.getTime()) / 1000 / 60;

    if (minutesSinceLastInteraction > STATE_TIMEOUT_MINUTES) {
      // State expired, clean up
      await cleanupState(supabase, chatId);
      return null;
    }

    return data as ConversationalState;
  } catch (error) {
    console.error("Error retrieving conversational state:", error);
    return null;
  }
}

/**
 * Clear conversational state for a chat
 */
export async function cleanupState(
  supabase: SupabaseClient,
  chatId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("conversational_state").delete().eq("chat_id", chatId);

    if (error) {
      console.error("Failed to cleanup conversational state:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error cleaning up conversational state:", error);
    return { success: false, error: "Failed to cleanup state" };
  }
}

/**
 * Clean up expired conversational states (run periodically)
 */
export async function cleanupExpiredStates(
  supabase: SupabaseClient,
): Promise<{ success: boolean; cleaned: number; error?: string }> {
  try {
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() - STATE_TIMEOUT_MINUTES);

    const { data, error } = await supabase
      .from("conversational_state")
      .delete()
      .lt("last_interaction", expirationTime.toISOString())
      .select();

    if (error) {
      console.error("Failed to cleanup expired states:", error);
      return { success: false, cleaned: 0, error: error.message };
    }

    return { success: true, cleaned: data?.length || 0 };
  } catch (error) {
    console.error("Error cleaning up expired states:", error);
    return { success: false, cleaned: 0, error: "Failed to cleanup expired states" };
  }
}
