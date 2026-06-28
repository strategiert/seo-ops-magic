function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractToolInput(content: readonly unknown[], toolName: string): unknown {
  const toolUse = content.find(
    (item) =>
      isRecord(item) &&
      item.type === "tool_use" &&
      item.name === toolName &&
      "input" in item
  );

  if (!isRecord(toolUse)) {
    throw new Error(`Tool response ${toolName} not found`);
  }

  return toolUse.input;
}
