/**
 * Indent-based YAML parser covering GitHub Actions workflow files in this
 * repository (mappings, sequences, scalars, and `|` literal blocks).
 */

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "") {
    return "";
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null" || value === "~") {
    return null;
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stripFullLineComments(text) {
  return text
    .split(/\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function collectLiteralBlock(lines, startIndex, parentIndent) {
  const collected = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      collected.push("");
      index += 1;
      continue;
    }
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent <= parentIndent) {
      break;
    }
    collected.push(line.slice(parentIndent + 2));
    index += 1;
  }
  return {
    value: collected.join("\n").replace(/\n+$/, ""),
    nextIndex: index,
  };
}

function parseNode(lines, startIndex, parentIndent) {
  let index = startIndex;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if (index >= lines.length) {
    return { value: null, nextIndex: index };
  }

  const firstIndent = lines[index].match(/^ */)?.[0].length ?? 0;
  if (firstIndent <= parentIndent) {
    return { value: null, nextIndex: index };
  }

  const firstTrimmed = lines[index].trim();
  if (firstTrimmed.startsWith("- ")) {
    const sequence = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === "") {
        index += 1;
        continue;
      }
      const indent = line.match(/^ */)?.[0].length ?? 0;
      if (indent <= parentIndent) {
        break;
      }
      if (indent !== firstIndent || !line.trim().startsWith("- ")) {
        break;
      }
      const itemBody = line.trim().slice(2);
      if (itemBody === "" || itemBody.endsWith(":") || /:\s*$/.test(itemBody)) {
        const key = itemBody.replace(/:\s*$/, "");
        const child = parseNode(lines, index + 1, firstIndent);
        sequence.push(key ? { [key]: child.value } : child.value);
        index = child.nextIndex;
        continue;
      }
      if (itemBody.includes(":")) {
        const colon = itemBody.indexOf(":");
        const key = itemBody.slice(0, colon).trim();
        const rest = itemBody.slice(colon + 1);
        if (rest.trim() === "|" || rest.trim() === ">") {
          const literal = collectLiteralBlock(lines, index + 1, firstIndent);
          sequence.push({ [key]: literal.value });
          index = literal.nextIndex;
          continue;
        }
        const mapping = { [key]: parseScalar(rest) };
        const child = parseNode(lines, index + 1, firstIndent);
        if (child.value && typeof child.value === "object") {
          Object.assign(mapping, child.value);
          index = child.nextIndex;
        } else {
          index += 1;
        }
        sequence.push(mapping);
        continue;
      }
      sequence.push(parseScalar(itemBody));
      index += 1;
    }
    return { value: sequence, nextIndex: index };
  }

  const mapping = {};
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent <= parentIndent) {
      break;
    }
    if (indent !== firstIndent) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      break;
    }
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new Error(`YAML line missing colon: ${trimmed}`);
    }
    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1);
    if (rest.trim() === "|" || rest.trim() === ">") {
      const literal = collectLiteralBlock(lines, index + 1, firstIndent);
      mapping[key] = literal.value;
      index = literal.nextIndex;
      continue;
    }
    if (rest.trim() === "") {
      const child = parseNode(lines, index + 1, firstIndent);
      mapping[key] = child.value;
      index = child.nextIndex;
      continue;
    }
    mapping[key] = parseScalar(rest);
    index += 1;
  }
  return { value: mapping, nextIndex: index };
}

export function parseSimpleYaml(text) {
  const stripped = stripFullLineComments(text);
  const lines = stripped.split(/\n/);
  const parsed = parseNode(lines, 0, -1);
  return parsed.value ?? {};
}

export function extractHeaderComments(text) {
  const comments = [];
  for (const line of text.split(/\n/)) {
    if (line.startsWith("#")) {
      comments.push(line.replace(/^#\s?/, ""));
      continue;
    }
    if (line.trim() === "") {
      continue;
    }
    break;
  }
  return comments;
}

export function parseGitHubActionsWorkflow(text) {
  const headerComments = extractHeaderComments(text);
  const doc = parseSimpleYaml(text);
  const job = doc?.jobs?.release ?? {};
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const onValue = doc?.on;
  const triggerKeys =
    onValue && typeof onValue === "object" ? Object.keys(onValue) : [];

  return {
    headerComments,
    name: doc?.name ?? "",
    on: onValue,
    triggerKeys,
    permissions: doc?.permissions ?? {},
    job,
    environment: job.environment ?? null,
    workingDirectory: job.defaults?.run?.["working-directory"] ?? null,
    inputs: onValue?.workflow_dispatch?.inputs ?? {},
    steps,
    doc,
  };
}
