import Card from "../components/Card";

function Popular() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">
        Top Nonemployer Industries in Your State
      </h2>
      <p className="mt-2 text-sm text-zb-ink-muted">
        Loading nonemployer industry rankings.
      </p>
    </Card>
  );
}

export default Popular;
