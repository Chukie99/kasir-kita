#!/usr/bin/env python
"""Upload a video file to YouTube as a Short (public) using Hermes Google token."""
import sys, os, json, time

TOKEN_PATH = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'hermes', 'google_token.json')

def get_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    tok = json.load(open(TOKEN_PATH, encoding='utf-8'))
    creds = Credentials(
        token=tok.get('token'),
        refresh_token=tok.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=tok.get('client_id'),
        client_secret=tok.get('client_secret'),
        scopes=tok.get('scopes', []),
    )
    if not creds.valid:
        creds.refresh(Request())
        tok['token'] = creds.token
        json.dump(tok, open(TOKEN_PATH, 'w', encoding='utf-8'))
    return build('youtube', 'v3', credentials=creds)

def resumable_upload(service, file_path, body):
    from googleapiclient.http import MediaFileUpload
    media = MediaFileUpload(file_path, chunksize=8 * 1024 * 1024, resumable=True,
                            mimetype='video/*')
    request = service.videos().insert(part='snippet,status', body=body, media_body=media)
    response = None
    retries = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                print(f"upload {int(status.progress() * 100)}%", flush=True)
        except Exception as e:
            retries += 1
            if retries > 5:
                raise
            print(f"retry {retries} after error: {e}", flush=True)
            time.sleep(2 ** retries)
    return response

def main():
    file_path, title, description = sys.argv[1], sys.argv[2], sys.argv[3]
    tags = sys.argv[4].split('|') if len(sys.argv) > 4 else []
    body = {
        'snippet': {
            'title': title[:100],
            'description': description,
            'tags': tags,
            'categoryId': '10',  # Music
        },
        'status': {
            'privacyStatus': 'public',
            'selfDeclaredMadeForKids': False,
        },
    }
    service = get_service()
    resp = resumable_upload(service, file_path, body)
    print(json.dumps({
        'videoId': resp.get('id'),
        'url': f"https://youtube.com/shorts/{resp['id']}",
        'title': resp['snippet']['title'],
        'status': resp['status']['privacyStatus'],
    }, indent=2))

if __name__ == '__main__':
    main()
