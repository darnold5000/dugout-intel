import { redirect } from "next/navigation";

export default async function UploadRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/opponents/${id}?tab=evidence`);
}
