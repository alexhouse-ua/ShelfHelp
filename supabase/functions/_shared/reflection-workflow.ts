/**
 * Reflection Workflow Module
 * Story: 2.3 Post-Read Reflection
 * Task 3: Implement LangGraph reflection state machine
 *
 * Provides LangGraph-based stateful conversation workflow for book reflections
 */

import { Annotation, END, START, StateGraph } from "npm:@langchain/langgraph@0.2";
import { BaseCheckpointSaver } from "npm:@langchain/langgraph-checkpoint@0.0.18";
import { PostgresSaver } from "npm:@langchain/langgraph-checkpoint-postgres@0.0.5";
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { Logger } from "./logger.ts";
import { Bot } from "https://deno.land/x/grammy@v1.38.2/mod.ts";

/**
 * Reflection questions (3 questions minimum per AC)
 */
export const REFLECTION_QUESTIONS = [
  "What did you enjoy most about this book?",
  "Was there anything you didn't like or found challenging?",
  "Would you recommend this book? Why or why not?",
] as const;

/**
 * Maximum retry attempts per question
 */
const MAX_RETRIES = 3;

/**
 * State timeout extension (60 minutes for reflection workflow)
 */
const REFLECTION_TIMEOUT_MINUTES = 60;

/**
 * Reflection State Schema
 */
export const ReflectionState = Annotation.Root({
  book_id: Annotation<string>,
  chat_id: Annotation<number>,
  book_title: Annotation<string>,
  book_author: Annotation<string>,
  current_question: Annotation<number>, // 1-based index
  responses: Annotation<Record<number, string>>({
    reducer: (_, b) => b, // Replace with new value
    default: () => ({}),
  }),
  retry_count: Annotation<number>,
  completed: Annotation<boolean>,
  error: Annotation<string | undefined>,
});

export type ReflectionStateType = typeof ReflectionState.State;

/**
 * Validates user reflection input
 */
export function validateReflectionInput(input: string): { valid: boolean; error?: string } {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Response cannot be empty" };
  }
  if (input.length > 2000) {
    return { valid: false, error: "Response too long (max 2000 characters)" };
  }
  return { valid: true };
}

/**
 * Sanitizes user input for Markdown
 */
export function sanitizeMarkdown(input: string): string {
  // Escape special Markdown characters to prevent injection
  return input.replace(/[*_`\[\]]/g, "\\$&").trim();
}

/**
 * Start Node: Initialize state and send first question
 */
async function startNode(
  state: ReflectionStateType,
  config: { bot: Bot; logger: Logger },
): Promise<Partial<ReflectionStateType>> {
  const { bot, logger } = config;

  try {
    logger.info("Starting reflection workflow", {
      operation: "reflection_start",
      book_id: state.book_id,
      chat_id: state.chat_id,
      book_title: state.book_title,
    });

    // Send first question
    const questionText = `Let's reflect on *${state.book_title}*!\n\n` +
      `**Question 1 of ${REFLECTION_QUESTIONS.length}:**\n` +
      REFLECTION_QUESTIONS[0];

    await bot.api.sendMessage(state.chat_id, questionText, {
      parse_mode: "Markdown",
    });

    return {
      current_question: 1,
    };
  } catch (error) {
    logger.error("Error in start node", {
      operation: "reflection_start",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: "Failed to start reflection workflow",
      completed: false,
    };
  }
}

/**
 * Ask Question Node: Send current question to user
 */
async function askQuestionNode(
  state: ReflectionStateType,
  config: { bot: Bot; logger: Logger },
): Promise<Partial<ReflectionStateType>> {
  const { bot, logger } = config;

  try {
    const questionIndex = state.current_question - 1;
    const questionText =
      `**Question ${state.current_question} of ${REFLECTION_QUESTIONS.length}:**\n` +
      REFLECTION_QUESTIONS[questionIndex];

    logger.info("Asking reflection question", {
      operation: "ask_question",
      book_id: state.book_id,
      chat_id: state.chat_id,
      question_number: state.current_question,
    });

    await bot.api.sendMessage(state.chat_id, questionText, {
      parse_mode: "Markdown",
    });

    return {}; // No state changes, just sending message
  } catch (error) {
    logger.error("Error in ask question node", {
      operation: "ask_question",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: "Failed to ask question",
    };
  }
}

/**
 * Process Response Node: Validate and store user response
 * Note: This node expects the response to be already added to state by the handler
 */
async function processResponseNode(
  state: ReflectionStateType,
  config: { supabase: SupabaseClient; logger: Logger },
): Promise<Partial<ReflectionStateType>> {
  const { supabase, logger } = config;

  try {
    const response = state.responses[state.current_question];

    if (!response) {
      logger.warn("No response found for current question", {
        operation: "process_response",
        question_number: state.current_question,
      });
      return {}; // Wait for response
    }

    // Validate response
    const validation = validateReflectionInput(response);
    if (!validation.valid) {
      if (state.retry_count >= MAX_RETRIES - 1) {
        // Max retries reached, skip this question
        logger.warn("Max retries reached, skipping question", {
          operation: "process_response",
          question_number: state.current_question,
        });
        return {
          current_question: state.current_question + 1,
          retry_count: 0,
        };
      }

      logger.warn("Invalid response, requesting retry", {
        operation: "process_response",
        question_number: state.current_question,
        retry_count: state.retry_count + 1,
        error: validation.error,
      });

      return {
        retry_count: state.retry_count + 1,
        error: validation.error,
      };
    }

    // Extend state timeout (60 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + REFLECTION_TIMEOUT_MINUTES);

    await supabase
      .from("conversational_state")
      .update({ expires_at: expiresAt.toISOString() })
      .eq("chat_id", state.chat_id);

    logger.info("Response processed successfully", {
      operation: "process_response",
      book_id: state.book_id,
      chat_id: state.chat_id,
      question_number: state.current_question,
      response_length: response.length,
    });

    // Move to next question
    return {
      current_question: state.current_question + 1,
      retry_count: 0,
      error: undefined,
    };
  } catch (error) {
    logger.error("Error in process response node", {
      operation: "process_response",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: "Failed to process response",
    };
  }
}

/**
 * Finalize Node: Save complete reflection to database
 */
async function finalizeNode(
  state: ReflectionStateType,
  config: { supabase: SupabaseClient; bot: Bot; logger: Logger },
): Promise<Partial<ReflectionStateType>> {
  const { supabase, bot, logger } = config;

  try {
    logger.info("Finalizing reflection workflow", {
      operation: "finalize_reflection",
      book_id: state.book_id,
      chat_id: state.chat_id,
      responses_count: Object.keys(state.responses).length,
    });

    // Concatenate all responses with question labels
    const userReflection = REFLECTION_QUESTIONS.map((question, idx) => {
      const response = state.responses[idx + 1];
      return response ? `Q${idx + 1}: ${question}\nA: ${response}` : null;
    })
      .filter(Boolean)
      .join("\n\n");

    // Save to reflections table
    const { error: insertError } = await supabase.from("reflections").insert({
      book_id: state.book_id,
      user_reflection: userReflection,
      ai_analysis: null, // Populated by Story 2.4
    });

    if (insertError) {
      logger.error("Failed to save reflection", {
        operation: "finalize_reflection",
        error: insertError.message,
      });
      return {
        error: "Failed to save reflection",
        completed: false,
      };
    }

    // Create reflection_completed event
    await supabase.from("book_events").insert({
      book_id: state.book_id,
      event_type: "reflection_completed",
      event_data: {
        chat_id: state.chat_id,
        completed_at: new Date().toISOString(),
        responses_count: Object.keys(state.responses).length,
      },
    });

    // Send confirmation message
    const summary = `Thanks for reflecting on *${state.book_title}*! 📚\n\n` +
      `Your insights have been captured.`;

    await bot.api.sendMessage(state.chat_id, summary, {
      parse_mode: "Markdown",
    });

    // Clean up conversational state
    await supabase.from("conversational_state").delete().eq("chat_id", state.chat_id);

    logger.info("Reflection workflow completed", {
      operation: "finalize_reflection",
      book_id: state.book_id,
      chat_id: state.chat_id,
    });

    return {
      completed: true,
    };
  } catch (error) {
    logger.error("Error in finalize node", {
      operation: "finalize_reflection",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: "Failed to finalize reflection",
      completed: false,
    };
  }
}

/**
 * Error Node: Handle errors and notify user
 */
async function errorNode(
  state: ReflectionStateType,
  config: { bot: Bot; logger: Logger },
): Promise<Partial<ReflectionStateType>> {
  const { bot, logger } = config;

  try {
    logger.error("Reflection workflow error", {
      operation: "reflection_error",
      book_id: state.book_id,
      chat_id: state.chat_id,
      error: state.error,
    });

    const errorMessage = `❌ Sorry, something went wrong with the reflection workflow.\n\n` +
      `You can try again later with /reflect.`;

    await bot.api.sendMessage(state.chat_id, errorMessage);

    return {
      completed: false,
    };
  } catch (error) {
    logger.error("Error in error node", {
      operation: "reflection_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * Conditional edge: Determine next node based on state
 */
function routeReflection(state: ReflectionStateType): string {
  // Check for errors
  if (state.error && state.retry_count === 0) {
    return "error";
  }

  // Check if all questions answered
  if (state.current_question > REFLECTION_QUESTIONS.length) {
    return "finalize";
  }

  // Continue asking questions
  return "ask_question";
}

/**
 * Initialize PostgreSQL checkpointer
 * Returns BaseCheckpointSaver to match StateGraph.compile() type signature
 */
export async function createReflectionCheckpointer(
  connectionString: string,
): Promise<BaseCheckpointSaver> {
  const checkpointer = PostgresSaver.fromConnString(connectionString);
  await checkpointer.setup(); // Required first-time setup
  return checkpointer;
}

/**
 * Create reflection workflow graph
 */
export function createReflectionWorkflow(
  checkpointer: BaseCheckpointSaver | undefined,
  config: { supabase: SupabaseClient; bot: Bot; logger: Logger },
): ReturnType<typeof StateGraph.prototype.compile> {
  const workflow = new StateGraph(ReflectionState)
    .addNode("start", (state) => startNode(state, config))
    .addNode("ask_question", (state) => askQuestionNode(state, config))
    .addNode("process_response", (state) => processResponseNode(state, config))
    .addNode("finalize", (state) => finalizeNode(state, config))
    .addNode("error", (state) => errorNode(state, config))
    .addEdge(START, "start")
    .addEdge("start", "process_response")
    .addConditionalEdges("process_response", routeReflection, ["ask_question", "finalize", "error"])
    .addEdge("ask_question", "process_response")
    .addEdge("finalize", END)
    .addEdge("error", END);

  return workflow.compile({ checkpointer });
}
