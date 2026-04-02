import { ExerciseForm } from "@/components/admin/ExerciseForm";

interface EditExercisePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExercisePage({ params }: EditExercisePageProps) {
  const resolvedParams = await params;

  return <ExerciseForm mode="edit" exerciseId={resolvedParams.id} />;
}
