"""
Extracts structured sections from a Cisco IOS / IOS-XE running-config.
Returns raw lines for the rule engine to inspect.
"""


def parse(config_text: str) -> list[str]:
    return config_text.splitlines()
