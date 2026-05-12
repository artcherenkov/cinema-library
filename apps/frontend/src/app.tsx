import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";

function App() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <h1>Hello world!</h1>
      <Button onClick={() => toast.info("Hello world!")}>Click me</Button>
    </div>
  );
}

export default App;
