with open('src/pages/Etiquetas.tsx', 'r') as f:
    balance = 0
    for i, line in enumerate(f, 1):
        opens = line.count('<div')
        closes = line.count('</div>')
        if opens > 0 or closes > 0:
            balance += opens
            balance -= closes
            print(f"Line {i}: opens={opens}, closes={closes}, balance={balance}")
