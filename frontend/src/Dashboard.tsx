import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { editQuestionRoute, createQuestionRoute } from './main';

export interface Question {
  id: string;
  difficulty: string;
  version: number;
  type: string;
  question?: string;
  prompt?: string;
  [key: string]: unknown;
}

export default function Dashboard() {
  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ['questions'],
    queryFn: async () => {
      const res = await fetch('/api/questions/');
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (questionsLoading) {
    return <div className="flex items-center justify-center h-screen text-xl bg-background dark:bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-gray-900 dark:text-gray-100 w-full max-w-2xl">
          <div className="flex justify-end mb-4">
            <Link
              to={createQuestionRoute.to}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-semibold shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition"
            >
              + New Question
            </Link>
          </div>
          <h2 className="text-xl font-semibold mb-4">Questions</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {questions && questions.length > 0 ? (
              questions.map(q => (
                <li key={q.id} className="flex items-center justify-between py-3">
                  <span className="truncate max-w-xs">
                    {q.question || q.prompt || <span className="italic text-gray-400 dark:text-gray-500">(No text)</span>}
                  </span>
                  <Link
                    to={editQuestionRoute.to}
                    params={{ id: q.id }}
                    className="ml-4 px-3 py-1 text-sm rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition"
                  >
                    Edit
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-gray-400 dark:text-gray-500 italic">No questions found.</li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
} 