with open('src/pages/Etiquetas.tsx', 'r') as f:
    balance = 0
    for i, line in enumerate(f, 1):
        balance += line.count('<div')
        balance -= line.count('</div>')
        if balance < 0:
            print(f"Balance broke at line {i}: {balance}")
            balance = 0
    print(f"Final balance: {balance}")
