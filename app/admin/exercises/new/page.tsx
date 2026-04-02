import { ExerciseForm } from "@/components/admin/ExerciseForm";

interface NewExercisePageProps {
  searchParams: Promise<{
    requestId?: string;
    name?: string;
  }>;
}

export default async function NewExercisePage({ searchParams }: NewExercisePageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <ExerciseForm
      mode="create"
      requestId={resolvedSearchParams.requestId}
      prefillName={resolvedSearchParams.name}
    />
  );
}
