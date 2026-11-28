FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

# --debug liga o reload automatico: salvou o arquivo, a API reinicia sozinha
CMD ["flask", "--app", "routes:criar_app", "run", "--host=0.0.0.0", "--port=8001", "--debug"]
