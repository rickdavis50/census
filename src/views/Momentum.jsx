import Card from "../components/Card";

function Momentum() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Metro Population Momentum</h2>
      <p className="mt-2 text-sm text-zb-ink-muted">
        Loading ACS population momentum data.
      </p>
    </Card>
  );
}

export default Momentum;
