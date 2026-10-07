import { ApiRsp } from '../../ApiType';

export async function registerApi({
  name,
  password,
  code
}: {
  name: string;
  password: string;
  code: string;
}): Promise<ApiRsp> {
  console.log('[DEBUG] API call started, name:', name);
  const rsp = await fetch('/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      password,
      code
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const json = await rsp.json();
  console.log('[DEBUG] API response:', json);
  return json;
}
