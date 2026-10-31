import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Button from "../../components/Button";
import { useEffect, useState } from "react";
import { Formik } from "formik";
import * as Yup from "yup";
import {
  fetchWorkspaces, createWorkspace, deleteWorkspace, leaveWorkspace,
  selectCreated, selectJoined, clearWorkspaceError,
} from "../../store/workspacesSlice";
import { logoutUser } from "../../store/authSlice";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const splitEmails = (value) => value.split(",").map((e) => e.trim()).filter(Boolean);

const validationSchemas = [
  Yup.object().shape({
    workspaceName: Yup.string().trim().required("Workspace name is required")
      .min(3, "Must be at least 3 characters").max(50, "Must be at most 50 characters"),
  }),
  Yup.object().shape({
    // emails are optional - you can also share the invite link later
    emails: Yup.string().trim().test("valid-emails", "One or more email addresses are invalid", (value) =>
      !value || splitEmails(value).every((email) => emailRegex.test(email))),
  }),
];

function WorkspaceRow({ w, action, actionLabel }) {
  return (
    <div className="flex items-center justify-between border border-gray-300 rounded-xl p-3 text-black hover:bg-emerald-50">
      <Link to={`/workspaces/${w._id}`} className="flex-1 min-w-0">
        <p className="font-semibold truncate">{w.name}</p>
        <p className="text-xs text-slate-500">
          {w.memberCount} member{w.memberCount === 1 ? "" : "s"}
          {w.role === "guest" ? " · Guest" : ""}
        </p>
      </Link>
      <div className="flex items-center gap-3">
        <button onClick={action} className="text-xs text-red-600 hover:underline cursor-pointer">{actionLabel}</button>
        <Link to={`/workspaces/${w._id}`} className="text-[#00694c] font-medium">Open →</Link>
      </div>
    </div>
  );
}

export default function Workspaces() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { loading, error: listError } = useSelector((s) => s.workspaces);
  const created = useSelector(selectCreated);
  const joined = useSelector(selectJoined);
  const [open, setmodel] = useState(false);
  const [step, setsteps] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => { dispatch(fetchWorkspaces()) }, [dispatch]);

  const handleClick = () => { setError(""); setmodel(true); setsteps(0); };

  const handleNext = async (values, { setTouched, setSubmitting }) => {
    if (step < 1) {
      setTouched({});
      setsteps((prev) => prev + 1);
      setSubmitting(false);
      return;
    }
    const result = await dispatch(createWorkspace({
      workspaceName: values.workspaceName.trim(),
      emails: splitEmails(values.emails),
    }));
    if (createWorkspace.fulfilled.match(result)) {
      const { failedEmails, data } = result.payload;
      if (failedEmails?.length) {
        alert(`Workspace created, but these invites could not be sent:\n${failedEmails.join("\n")}\n\nYou can share the invite link from inside the workspace instead.`);
      }
      setmodel(false);
      navigate(`/workspaces/${data._id}`);
    } else {
      setError(result.payload || "Could not create workspace");
      setSubmitting(false);
    }
  };

  const handleDelete = (w) => {
    if (confirm(`Delete "${w.name}" for everyone? All channels, messages and files will be removed permanently.`)) {
      dispatch(deleteWorkspace(w._id));
    }
  };
  const handleLeave = (w) => {
    if (confirm(`Leave "${w.name}"?`)) dispatch(leaveWorkspace(w._id));
  };

  return (
    <>
      <div className="bg-teal-800 min-h-screen w-full text-center text-amber-50 pb-10">
        <div className="flex justify-end items-center gap-4 p-4 text-sm">
          <Link to="/profile" className="hover:underline">{user?.name}</Link>
          <Button onclick={() => dispatch(logoutUser())} text="Log out" bgcolor="bg-teal-700" color="text-white" />
        </div>
        <h1 className="text-4xl p-4 font-extrabold">Welcome back{user ? `, ${user.name}` : ""}!</h1>
        <p className="text-xl font-serif pb-6">Pick a workspace below to get back to working with your team.</p>

        <div className="bg-white p-2 pb-4 mx-4 md:mx-auto md:max-w-3xl shadow-xl rounded-3xl text-left">
          <div className="flex items-center justify-start">
            <img src="/logo.png" className="h-15 w-56" />
            <span className="text-black font-serif">| Workspaces</span>
          </div>
          <hr className="text-black mb-4" />

          <div className="px-4 space-y-5 text-black">
            {loading && <p className="text-slate-500">Loading...</p>}
            {listError && <p className="text-red-600 text-sm" onClick={() => dispatch(clearWorkspaceError())}>{listError}</p>}

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Workspaces you created</h2>
              <div className="space-y-2">
                {!loading && created.length === 0 && <p className="text-slate-400 text-sm">You haven't created a workspace yet.</p>}
                {created.map((w) => (
                  <WorkspaceRow key={w._id} w={w} actionLabel="Delete" action={() => handleDelete(w)} />
                ))}
              </div>
              <div className="pt-3">
                <Button onclick={handleClick} text="Create a Workspace" bgcolor="bg-[#00694c]" color="text-teal-100" />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Workspaces you were invited to</h2>
              <div className="space-y-2">
                {!loading && joined.length === 0 && (
                  <p className="text-slate-400 text-sm">Nothing here yet. Open an invite link from your email to join a team.</p>
                )}
                {joined.map((w) => (
                  <WorkspaceRow key={w._id} w={w} actionLabel="Leave" action={() => handleLeave(w)} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {open && (
        <Formik
          initialValues={{ workspaceName: "", emails: "" }}
          validationSchema={validationSchemas[step]}
          onSubmit={handleNext}
          validateOnBlur={false}
          validateOnChange={false}
        >
          {({ values, handleChange, handleSubmit, errors, touched, isSubmitting }) => (
            <div onClick={() => setmodel(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div onClick={(e) => e.stopPropagation()} className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl text-black text-left">
                {step === 0 && (
                  <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold">What do you want to call your workspace?</h1>
                    <p className="text-gray-600 text-sm">Choose something your team will recognize, like the name of your company or team.</p>
                    <input type="text" name="workspaceName" value={values.workspaceName} onChange={handleChange}
                      placeholder="e.g. Acme Corp"
                      className={`border p-2 rounded-lg w-full focus:outline-teal-600 ${errors.workspaceName && touched.workspaceName ? "border-red-500" : ""}`} />
                    {errors.workspaceName && touched.workspaceName && <span className="text-red-500 text-xs">{errors.workspaceName}</span>}
                    <Button onclick={handleSubmit} text="Next" bgcolor="bg-[#00694c]" color="text-teal-100" />
                  </div>
                )}
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold">Who else is on the team?</h1>
                    <p className="text-gray-600 text-sm">Add coworkers by email (separated by commas). You can skip this and share an invite link later.</p>
                    <input type="text" name="emails" value={values.emails} onChange={handleChange}
                      placeholder="alex@co.com, sam@co.com"
                      className={`border p-2 rounded-lg w-full focus:outline-teal-600 ${errors.emails && touched.emails ? "border-red-500" : ""}`} />
                    {errors.emails && touched.emails && <span className="text-red-500 text-xs">{errors.emails}</span>}
                    {error && <span className="text-red-600 text-sm">{error}</span>}
                    <div className="flex gap-2 justify-end">
                      <Button onclick={() => setsteps(0)} text="Back" bgcolor="bg-gray-300" color="text-black" />
                      <Button onclick={handleSubmit}
                        text={isSubmitting ? "Creating..." : values.emails.trim() ? "Create & Send Invites" : "Create"}
                        bgcolor="bg-[#00694c]" color="text-teal-100" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Formik>
      )}
    </>
  );
}
