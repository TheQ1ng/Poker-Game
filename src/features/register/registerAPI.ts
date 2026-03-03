import { ApiRsp } from '../../ApiType';

export async function registerApi({
  name,
  password
}: {
  name: string;
  password: string;
}): Promise<ApiRsp> {
  console.log('[DEBUG] API call started, name:', name);
  const rsp = await fetch('/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      password
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const json = await rsp.json();
  console.log('[DEBUG] API response:', json);
  return json;
}
