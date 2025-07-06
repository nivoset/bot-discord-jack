import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

export default function CreateQuestion() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [incorrectAnswers, setIncorrectAnswers] = useState<string[]>(['']);

  type PostPayload = {
    question: string;
    difficulty: string;
    correct_answer: string;
    incorrect_answers: string[];
    type?: string;
    version?: number;
  };

  const mutation = useMutation({
    mutationFn: async (payload: PostPayload) => {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create question');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate({ to: '/' });
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 w-full max-w-3xl">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Create New Question</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            mutation.mutate({
              question: text,
              difficulty,
              correct_answer: correctAnswer,
              incorrect_answers: incorrectAnswers.filter(ans => ans.trim() !== ''),
              type: 'bad-boss',
              version: 1,
            });
          }}
          className="flex flex-col gap-4"
        >
          <label className="font-medium text-gray-700 dark:text-gray-200">
            Question/Prompt
            <textarea
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              required
            />
          </label>
          <label className="font-medium text-gray-700 dark:text-gray-200">
            Difficulty
            <select
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              required
            >
              {DIFFICULTY_LEVELS.map(level => (
                <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="font-medium text-gray-700 dark:text-gray-200">
            Correct Answer
            <input
              type="text"
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2"
              value={correctAnswer}
              onChange={e => setCorrectAnswer(e.target.value)}
              required
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-200">Incorrect Answers</span>
            {incorrectAnswers.map((ans, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2"
                  value={ans}
                  onChange={e => {
                    const newArr = [...incorrectAnswers];
                    newArr[idx] = e.target.value;
                    setIncorrectAnswers(newArr);
                  }}
                  required
                />
                <button
                  type="button"
                  className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => setIncorrectAnswers(incorrectAnswers.filter((_, i) => i !== idx))}
                  disabled={incorrectAnswers.length <= 1}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 self-start"
              onClick={() => setIncorrectAnswers([...incorrectAnswers, ''])}
            >
              Add Incorrect Answer
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition font-semibold"
              onClick={() => navigate({ to: '/' })}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition font-semibold"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 