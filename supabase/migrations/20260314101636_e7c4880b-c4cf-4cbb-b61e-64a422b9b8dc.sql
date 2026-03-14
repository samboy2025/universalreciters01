-- Fix recursive RLS on conversation_members and allow conversation creators to add other members safely

-- Helper: check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = _conversation_id
      AND cm.user_id = _user_id
  );
$$;

-- Helper: check conversation creator without relying on conversation SELECT RLS
CREATE OR REPLACE FUNCTION public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND c.created_by = _user_id
  );
$$;

DROP POLICY IF EXISTS "Users can view members of own conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add members to own conversations" ON public.conversation_members;

CREATE POLICY "Users can view members of own conversations"
ON public.conversation_members
FOR SELECT
TO public
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Users can add members to own conversations"
ON public.conversation_members
FOR INSERT
TO public
WITH CHECK (
  user_id = auth.uid()
  OR public.is_conversation_creator(conversation_id, auth.uid())
);