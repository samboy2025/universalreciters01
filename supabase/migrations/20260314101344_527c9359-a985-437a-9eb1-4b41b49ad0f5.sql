
-- Allow conversation members to update their conversations (e.g. updated_at)
CREATE POLICY "Members can update conversations"
ON public.conversations
FOR UPDATE
TO public
USING (id IN (
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
))
WITH CHECK (id IN (
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
));

-- Allow conversation members to update messages (e.g. is_read)
CREATE POLICY "Members can update messages in own conversations"
ON public.messages
FOR UPDATE
TO public
USING (conversation_id IN (
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()))
WITH CHECK (conversation_id IN (
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()));
