import {
  redirect,
  type LinksFunction,
  type LoaderFunction,
  type V2_MetaFunction,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Button from "~/components/Button";
import Editor from "~/components/Editor";
import Sidebar from "~/components/Sidebar";
import { replaceSpacesWithHTMLTag } from "~/lib/utils";
import { getTextToDisplay, getTextToDisplayByUser } from "~/model/text";
import globalStyle from "~/styles/global.css";
import { Space } from "~/tiptapProps/extension";
import { editorProps } from "~/tiptapProps/events";
import checkUnknown from "~/lib/checkUnknown";
import { useEffect, useMemo } from "react";
import { createUserIfNotExists } from "~/model/user";
import pusher from "~/service/pusher.server";
import usePusherPresence from "~/lib/usePresence";

export const loader: LoaderFunction = async ({ request }) => {
  let env = process.env;
  let url = new URL(request.url);

  let session = url.searchParams.get("session");
  if (!session) return { error: "No session" };

  let channel = await pusher.get({
    path: "/channels/presence-text/users",
    params: {},
  });
  let presence = await channel.json();
  let { users: activeText } = presence;
  let user = await createUserIfNotExists(session);
  let text = await getTextToDisplay(activeText, user?.id);
  let textFromUser = await getTextToDisplayByUser(user?.id);

  return { text, textFromUser, user, env };
};

export const meta: V2_MetaFunction = () => {
  return [
    { title: "Pecha Tools" },
    { name: "description", content: "Word segmentation" },
  ];
};
export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: globalStyle }];
};
export default function Index() {
  let fetcher = useFetcher();
  const data = useLoaderData();
  let text = data?.text?.original_text || "";
  const { textOnline } = usePusherPresence(
    `presence-text`,
    data.env.key,
    data.env.cluster,
    data.user,
    data?.text
  );
  let user = data.user;
  let newText = checkUnknown(replaceSpacesWithHTMLTag(text));

  const setter = () => {};
  let textMemo = useMemo(() => {
    if (newText) return newText;
  }, [newText]);
  const editor = useEditor(
    {
      extensions: [StarterKit, Space(setter)],
      content: textMemo,
      editorProps,
    },
    [textMemo]
  );
  let saveText = async () => {
    let modified_text = editor!.getText();
    let id = data.text.id;
    fetcher.submit(
      { id, modified_text, userId: user.id },
      { method: "POST", action: "/api/text" }
    );
  };
  let undoTask = async () => {
    let text = checkUnknown(
      replaceSpacesWithHTMLTag(data?.text?.original_text)
    );
    editor?.commands.setContent(text);
  };
  let ignoreTask = async () => {
    let id = data.text.id;
    fetcher.submit(
      { id, userId: user.id, _action: "ignore" },
      { method: "PATCH", action: "/api/text" }
    );
  };
  let rejectTask = async () => {
    let id = data.text.id;
    fetcher.submit(
      { id, userId: user.id, _action: "reject" },
      { method: "PATCH", action: "/api/text" }
    );
  };
  let isButtonDisabled = !editor || !data.text;
  if (data.error) return <div>{data.error}</div>;
  return (
    <div className="main">
      <Sidebar user={data.user} online={textOnline} />

      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {!data.text && <div>Thank you . your work is complete ! 😊😊😊</div>}

        <div className="container" onClick={() => editor?.commands.focus()}>
          <div className="label">transcript</div>
          <Editor editor={editor!} />
          {!editor && <div>loading...</div>}
        </div>
        <div className="btn-container">
          <Button
            disabled={isButtonDisabled}
            handleClick={saveText}
            value="CONFIRM"
            title="CONFIRM"
          />
          <Button
            disabled={isButtonDisabled}
            handleClick={rejectTask}
            value="REJECT"
            title="REJECT"
          />
          <Button
            disabled={isButtonDisabled}
            handleClick={ignoreTask}
            value="IGNORE"
            title="IGNORE"
          />
          <Button
            disabled={isButtonDisabled}
            handleClick={undoTask}
            value="UNDO"
            title="UNDO"
          />
        </div>
      </div>
    </div>
  );
}
