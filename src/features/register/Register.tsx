import React from "react";
import { Button, Form, Input } from "antd";

import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { MarkitBadge } from "../../components/MarkitBadge";
import { MarkitArtwork } from "../../components/MarkitArtwork";
import { registerAsync, selectError } from "./registerSlice";
import "./markitLogin.css";

function Register({
  onBackClick,
}: {
  onBackClick?: () => void;
}) {
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);
  const loading = useAppSelector((state) => state.register.status === "loading");

  const onFinish = (values: { name: string; password: string; code: string }) => {
    const code = String(values.code ?? "").trim().toUpperCase();

    dispatch(
      registerAsync({
        account: {
          name: values.name,
          password: values.password,
          code,
        },
        dispatch,
      })
    );
  };

  return (
    <div className="markit-login-shell">
      <section className="markit-login-hero" aria-hidden="true">
        <MarkitArtwork className="markit-login-hero-artwork" variant="hero-office" title="首页视觉图" />
        <div className="markit-login-hero-overlay" />
        <div className="markit-login-hero-copy">
          <h2>发现身边正在发生的新鲜事。</h2>
          <p>加入灵感与创意汇聚的社区，一起把日常过得更有意思。</p>
        </div>
      </section>

      <section className="markit-login-panel">
        <div className="markit-login-panel-inner">
          <button
            className="markit-login-back"
            type="button"
            onClick={onBackClick ?? (() => window.history.replaceState({}, "", "/"))}
            aria-label="返回首页"
          >
            <span aria-hidden="true">←</span>
            返回首页
          </button>

          <div className="markit-login-heading">
            <MarkitBadge size={64} className="markit-login-badge" />
            <div className="markit-login-heading-copy">
              <h1 className="markit-login-title">欢迎回来</h1>
              <p className="markit-login-subtitle">登录账号后继续使用。</p>
            </div>
          </div>

          <Form
            layout="vertical"
            requiredMark={false}
            className="markit-login-form"
            autoComplete="off"
            onFinish={onFinish}
          >
            <Form.Item
              label="账号"
              name="name"
              rules={[{ required: true, message: "请输入账号" }]}
            >
              <Input placeholder="请输入账号" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              label="网页令牌"
              name="code"
              normalize={(value) =>
                String(value ?? "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 5)
              }
              rules={[
                { required: true, message: "请输入网页令牌" },
                { len: 5, message: "请输入 5 位大写字母或数字" },
              ]}
            >
              <Input placeholder="请输入 5 位令牌" maxLength={5} />
            </Form.Item>

            {error ? <div className="markit-login-error">{error}</div> : null}

            <Button className="markit-login-submit" htmlType="submit" loading={loading}>
              登录 / 注册
            </Button>
          </Form>
        </div>
      </section>
    </div>
  );
}

export default Register;
