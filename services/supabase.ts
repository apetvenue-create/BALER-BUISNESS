
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://ogrxocjuvitktsiecwzg.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncnhvY2p1dml0a3RzaWVjd3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjk0ODcsImV4cCI6MjA4Mjc0NTQ4N30.NDMqogJ26hSRQDkjF91n9oMgOYuLwZnEorhZJNoZxDw';

export const supabase = createClient(PROJECT_URL, API_KEY);
