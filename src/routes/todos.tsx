import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "../utils/supabase";

type Todo = { id: string; name: string };

export const Route = createFileRoute("/todos")({
  loader: async () => {
    const { data: todos } = await supabase.from("todos").select("id, name");
    return { todos: (todos ?? []) as Todo[] };
  },
  component: Home,
});

function Home() {
  const { todos } = Route.useLoaderData();

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  );
}
