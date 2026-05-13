import joblib
import os

# 1. Calculamos la ruta exacta de la carpeta donde está este script
directorio_actual = os.path.dirname(os.path.abspath(__file__))

# 2. Unimos esa ruta con el nombre del archivo
ruta_absoluta = os.path.join(directorio_actual, 'columnas_modelo.pkl')

# 3. Cargamos el archivo usando la ruta absoluta
columnas = joblib.load(ruta_absoluta)

print(f"Número total de columnas: {len(columnas)}")
print("\n--- LISTA DE COLUMNAS EXACTAS ---")
for i, col in enumerate(columnas):
    print(f"{i + 1}. {col}")