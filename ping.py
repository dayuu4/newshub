"""NewsHub Cloud — Netlify Function  /.netlify/functions/ping"""
import json

def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type':  'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({'ok': True, 'version': '3.0', 'mode': 'cloud'}),
    }
