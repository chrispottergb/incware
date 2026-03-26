
CREATE POLICY "Admins can insert resources"
ON public.resources
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update resources"
ON public.resources
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete resources"
ON public.resources
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
