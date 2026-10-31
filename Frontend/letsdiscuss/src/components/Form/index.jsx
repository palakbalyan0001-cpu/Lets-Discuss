import { useFormik } from "formik"
import Button from "../Button";

export default function Form(props) {
    const formik = useFormik({
        initialValues: props.initialState,
        validationSchema: props.validation,
        onSubmit: (values) => props.submitAction(values)
    })
    const renderform = (field) => {
        const haserror = formik.touched[field.name] && formik.errors[field.name];
        switch (field.type) {
            case "select":
                return (
                    <div className="space-x-6" key={field.name}>
                        <label htmlFor={field.name}>{field.placeholder}</label>
                        <select name={field.name} {...formik.getFieldProps(field.name)} id={field.name}>
                            {field.options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                )
            default:
                return (
                    <div className="my-2" key={field.name}>
                        <input className="border rounded border-gray-700 p-1 m-1 w-64" {...formik.getFieldProps(field.name)} type={field.type} id={field.name} placeholder={field.placeholder} />
                        {haserror ? <p className="text-red-500 text-xs text-left p-1 ">{haserror}</p> : null}
                    </div>
                )
        }
    }
    return (
        <form onSubmit={formik.handleSubmit} >
            {props.data.map((fields) => renderform(fields))}
            <Button type="submit" text={formik.isSubmitting ? "Please wait..." : props.buttontext} bgcolor="bg-[#00694c]" color="text-teal-100" width="w-full"></Button>
        </form>
    )
}
