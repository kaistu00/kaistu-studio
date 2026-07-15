"""KAISTU Studio MCP Server — entry point with stdio transport."""

import logging
import sys

from server import mcp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)


def main():
    logging.info("[MCP] Server starting")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
