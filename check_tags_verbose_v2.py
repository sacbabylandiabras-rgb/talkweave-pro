import re
with open('src/pages/Etiquetas.tsx', 'r') as f:
    balance = 0
    for i, line in enumerate(f, 1):
        opens = len(re.findall(r'<div\b', line))
        closes = len(re.findall(r'</div>', line))
        if opens > 0 or closes > 0:
            balance += opens
            balance -= closes
            print(f"Line {i}: opens={opens}, closes={closes}, balance={balance} | {line.strip()[:50]}")
