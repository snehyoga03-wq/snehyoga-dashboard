-- Create registrations table for storing form submissions
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert registrations (public form)
CREATE POLICY "Anyone can insert registrations" 
ON public.registrations 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Create policy to allow authenticated users to view all registrations
CREATE POLICY "Authenticated users can view registrations" 
ON public.registrations 
FOR SELECT 
TO authenticated
USING (true);