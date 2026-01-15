const onlinePeople = [
  { name: "Padgett Longman", role: "Marketing Department" },
  { name: "Leonardor Knoxer", role: "Media Director" },
  { name: "Olivia Macadamer", role: "Group Account Director" },
  { name: "Jamie Antoinette", role: "Planning Supervisor" },
  { name: "Milo Masson", role: "Branch Manager" },
  { name: "Belinda Raman", role: "Executive Marketing Director" },
  { name: "Adele Bessemer", role: "Transportation Manager" },
];

const offlinePeople = [
  { name: "Lukas Podolski", role: "Applications Programmer" },
  { name: "Frank Elstner", role: "LAN Administrator" },
  { name: "Mariah Careyery", role: "Marketing and Sales Director" },
];

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const PersonRow = ({ person }) => (
  <div className="flex items-center gap-3 border-b border-dash-border py-3 last:border-b-0">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dash-surface-2 text-xs font-semibold text-dash-ink">
      {initials(person.name)}
    </div>
    <div>
      <p className="text-sm text-dash-ink">{person.name}</p>
      <p className="text-xs text-dash-muted">{person.role}</p>
    </div>
  </div>
);

function RightPanel() {
  return (
    <aside className="dash-card flex h-full flex-col gap-4 p-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Online</h3>
        <div className="dash-scroll max-h-[360px] space-y-1 overflow-y-auto pr-2">
          {onlinePeople.map((person) => (
            <PersonRow key={person.name} person={person} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Offline</h3>
        <div className="dash-scroll max-h-[240px] space-y-1 overflow-y-auto pr-2">
          {offlinePeople.map((person) => (
            <PersonRow key={person.name} person={person} />
          ))}
        </div>
      </div>
    </aside>
  );
}

export default RightPanel;
