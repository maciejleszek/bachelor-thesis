import { NavLink } from "react-router-dom";

const items = [
  { to: "/",        label: "Dashboard", icon: "📊" },
  { to: "/survey",  label: "Ankieta",   icon: "📝" },
  { to: "/history", label: "Historia",  icon: "📅" },
  { to: "/data",    label: "Dane",      icon: "⌚" },
];

export default function NavBar() {
  return (
    <nav className="nav">
      {items.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          end={to === "/"}
        >
          <span style={{ fontSize: "1.3rem" }}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
