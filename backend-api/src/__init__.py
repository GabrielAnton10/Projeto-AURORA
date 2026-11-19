from flask import Blueprint

telemetria_bp = Blueprint('telemetria', __name__,url_prefix='api/v1/telemetria')
aurora_bp = Blueprint('aurora',__name__,url_prefix='api/v1/aurora')
sensores_bp = Blueprint('sensores',__name__,url_prefix='api/v1/sensores')
leituras_bp = Blueprint('leituras',__name__,url_prefix='api/v1/leituras')
monitoramento_bp = Blueprint('monitoramento', __name__,url_prefix='api/v1/monitoramento')

