#!/usr/bin/env python3
"""Prueba tmux real + Codex fake; repositorio temporal, sin red ni producto."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import uuid


def command(argv, **kwargs):
    return subprocess.run(argv, check=True, text=True, capture_output=True, **kwargs).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launcher', type=Path, default=Path(__file__).resolve().parents[1] / 'crm-agents.py')
    args = parser.parse_args()
    launcher = args.launcher.resolve(strict=True)
    tmux = shutil.which('tmux')
    if not tmux:
        raise SystemExit('No probado: tmux no está instalado')
    socket = 'eli-smoke-' + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='eli-tmux-smoke-') as folder:
        root = Path(folder)
        repo, worktree, binaries = root/'repo', root/'worker', root/'bin'
        repo.mkdir()
        binaries.mkdir()
        command(['git', 'init', '-b', 'feat/crm', str(repo)])
        command(['git', '-C', str(repo), '-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.test',
                 'commit', '--allow-empty', '-m', 'fixture'])
        command(['git', '-C', str(repo), 'worktree', 'add', '-b', 'feat/crm-fallo', str(worktree)])
        roles = repo/'.Codex/agents'
        roles.mkdir(parents=True)
        (roles/'crm-apoyo.toml').write_text('name="crm-apoyo"\nmodel="gpt-6-luna"\ndescription="Fake"\ndeveloper_instructions="Solo fixture"\n')
        catalog = root/'catalog.json'
        catalog.write_text(json.dumps({'models': [{'slug': 'gpt-6-luna'}]}))
        prompt = root/'prompt.txt'
        prompt.write_text('Fallo sintético esperado; sin archivos del producto.')
        fake = binaries/'codex'
        fake.write_text('#!' + sys.executable + '\n' + '''import json, pathlib, sys
args = sys.argv[1:]
pathlib.Path(args[args.index('-o')+1]).write_text('Fallo simulado; no aprobar entrega.')
print(json.dumps({'type':'thread.started','thread_id':'11111111-1111-4111-8111-111111111111'}), flush=True)
print(json.dumps({'type':'turn.failed','error':{'message':'FALLO_SINTETICO_ESPERADO'}}), flush=True)
sys.exit(0)
''')
        fake.chmod(0o700)
        env = {**os.environ, 'PATH': str(binaries) + os.pathsep + os.environ['PATH']}
        env.pop('CRM_AGENT_RUN_ID', None)
        cli = [sys.executable, str(launcher), '--repo', str(repo), '--socket', socket,
               '--session', 'eli-crm-smoke', '--catalog', str(catalog)]
        try:
            run = json.loads(command(cli + ['start', '--task', 'SIM-FALLO', '--role', 'crm-apoyo',
                            '--worktree', str(worktree), '--prompt-file', str(prompt),
                            '--owns', 'fixture.txt'], env=env))
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                state = json.loads(command(cli + ['status', run['id']], env=env))
                if state['state'] not in ('starting', 'running'):
                    break
                time.sleep(.1)
            else:
                raise AssertionError('Timeout: runner no terminó')
            assert state['state'] == 'failed', state
            assert state['exit'] == 0, state
            assert 'FALLO_SINTETICO_ESPERADO' in state['result'], state
            assert state['codex_session'] == '11111111-1111-4111-8111-111111111111', state
            pane = command([tmux, '-L', socket, 'capture-pane', '-p', '-t', state['pane']])
            assert 'failed' in pane and 'FALLO_SINTETICO' in pane, pane
            print(json.dumps({'result': 'PASS', 'scenario': 'tmux real / turn.failed con exit 0',
                              'state': state['state'], 'exit': state['exit'],
                              'visible_in_pane': True}, ensure_ascii=False))
        finally:
            subprocess.run([tmux, '-L', socket, 'kill-server'], capture_output=True)


if __name__ == '__main__':
    main()
