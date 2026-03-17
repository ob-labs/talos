"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumb() {
  const pathname = usePathname();

  // Don't show breadcrumbs on the home page
  if (!pathname || pathname === "/") {
    return null;
  }

  // Split pathname into segments
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;

    // Format the segment name (capitalize first letter, replace hyphens with spaces)
    const name = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return { href, name, isLast };
  });

  // English name mapping for common routes
  const nameMap: Record<string, string> = {
    tasks: "Task Monitor",
    prd: "PRD List",
    history: "History",
    settings: "Settings",
    roles: "Roles",
    models: "Models",
  };

  // Add home as first item
  const allItems = [{ href: "/", name: "Home", isLast: items.length === 0 }, ...items.map(item => ({
    ...item,
    name: nameMap[item.name.toLowerCase()] || item.name
  }))];

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        {allItems.map((item, index) => (
          <li key={item.href} className="flex items-center">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 mx-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {item.isLast ? (
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
