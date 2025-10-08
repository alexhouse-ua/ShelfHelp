-- Migration: Add trigger to detect book status change to 'finished'
-- Story: 2.3 Post-Read Reflection
-- Task 1: Update books table trigger to detect status change to 'finished'

-- Create trigger function to detect when a book is marked as 'finished'
CREATE OR REPLACE FUNCTION trigger_reflection_workflow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if status changed TO 'finished' (not already finished)
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    INSERT INTO book_events (book_id, event_type, event_data)
    VALUES (
      NEW.id,
      'reflection_requested',
      jsonb_build_object(
        'title', NEW.title,
        'author', NEW.author,
        'user_date_finished', NEW.user_date_finished,
        'triggered_at', NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on books table
CREATE TRIGGER books_status_finished_trigger
AFTER UPDATE OF status ON books
FOR EACH ROW
EXECUTE FUNCTION trigger_reflection_workflow();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_reflection_workflow() IS 'Triggers reflection workflow when book status changes to finished';
