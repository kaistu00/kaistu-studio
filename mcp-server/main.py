"""KAISTU Studio MCP Server — entry point with stdio transport."""

from server import mcp


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
